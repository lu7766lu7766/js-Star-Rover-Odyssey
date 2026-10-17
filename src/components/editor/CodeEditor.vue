<template>
  <div class="code-editor-container">
    <!-- Flight Computer Tab Header -->
    <div class="editor-header">
      <div class="header-left">
        <div class="file-tab">
          <FileCode :size="14" class="icon-file" />
          <span class="file-name">solution.js</span>
          <span class="status-indicator" title="程式碼已即時自動快取">
            <span class="beacon-dot success"></span>
          </span>
        </div>
      </div>

      <div class="header-right">
        <div class="shortcut-tip" title="在編輯器裡按這組快捷鍵也能執行">
          <span>{{ runShortcutLabel }} 執行</span>
        </div>
        <button
          class="btn btn-sm btn-reset"
          :class="{ 'is-confirming': confirmingReset }"
          @click="handleResetClick"
          title="把程式碼恢復成本關一開始的樣子（之後可按 Ctrl+Z 復原）"
        >
          <RotateCcw :size="12" />
          <span>{{ confirmingReset ? '再按一次確定' : '重設' }}</span>
        </button>
      </div>
    </div>

    <!-- CodeMirror Viewport Container -->
    <div class="editor-viewport" ref="editorParent"></div>

    <!-- 逐行追蹤工具列：執行後出現，可以一步一步看程式怎麼跑 -->
    <TracePlayer />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { FileCode, RotateCcw } from 'lucide-vue-next';
import { EditorState, Compartment, StateField, StateEffect } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { createLevelCompletions } from './editorConfig.js';
import { useLevelStore } from '../../stores/levelStore.js';
import { fixFullWidth } from '../../utils/errorTranslator.js';
import TracePlayer from '../controls/TracePlayer.vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  levelId: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits(['update:modelValue', 'change', 'reset', 'run']);

const levelStore = useLevelStore();
const editorParent = ref(null);
let view = null;
const completionCompartment = new Compartment();

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const runShortcutLabel = isMac ? '⌘+Enter' : 'Ctrl+Enter';

// 重設程式碼要按兩次，避免學生誤按把寫好的程式洗掉
const confirmingReset = ref(false);
let confirmTimer = null;
function handleResetClick() {
  if (!confirmingReset.value) {
    confirmingReset.value = true;
    confirmTimer = setTimeout(() => { confirmingReset.value = false; }, 3000);
    return;
  }
  clearTimeout(confirmTimer);
  confirmingReset.value = false;
  emit('reset');
}

// ---- 錯誤行標示：紅底 + 行內白話說明（程式碼一改就自動消失） ----
const setErrorEffect = StateEffect.define();

class ErrorExplainWidget extends WidgetType {
  constructor(info) {
    super();
    this.info = info;
  }

  eq(other) {
    return other.info === this.info;
  }

  toDOM(editorView) {
    const box = document.createElement('div');
    box.className = 'cm-error-explain';
    const title = document.createElement('div');
    title.className = 'cm-error-explain-title';
    title.textContent = `第 ${this.info.line} 行：${this.info.title}`;
    box.appendChild(title);
    if (this.info.explain) {
      const explain = document.createElement('div');
      explain.className = 'cm-error-explain-text';
      explain.textContent = this.info.explain;
      box.appendChild(explain);
    }
    if (this.info.fixable) {
      const btn = document.createElement('button');
      btn.className = 'cm-error-fix-btn';
      btn.textContent = '一鍵修正全形符號';
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        const doc = editorView.state.doc.toString();
        editorView.dispatch({ changes: { from: 0, to: doc.length, insert: fixFullWidth(doc) } });
        editorView.focus();
      });
      box.appendChild(btn);
    }
    return box;
  }

  ignoreEvent() {
    return true;
  }
}

const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setErrorEffect)) {
        const info = e.value;
        if (!info || !info.line || info.line > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(info.line);
        return Decoration.set([
          Decoration.line({ class: 'cm-error-line' }).range(line.from),
          Decoration.widget({ widget: new ErrorExplainWidget(info), block: true, side: 1 }).range(line.to)
        ]);
      }
    }
    // 學生一動手修改，就把舊的錯誤標示收起來
    return tr.docChanged ? Decoration.none : decos;
  },
  provide: (f) => EditorView.decorations.from(f)
});

// ---- 逐行追蹤：目前執行到的那一行亮青色 ----
const setExecLineEffect = StateEffect.define();
const execLineField = StateField.define({
  create: () => Decoration.none,
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setExecLineEffect)) {
        const lineNo = e.value;
        if (!lineNo || lineNo > tr.state.doc.lines) return Decoration.none;
        return Decoration.set([Decoration.line({ class: 'cm-exec-line' }).range(tr.state.doc.line(lineNo).from)]);
      }
    }
    return tr.docChanged ? Decoration.none : decos;
  },
  provide: (f) => EditorView.decorations.from(f)
});

function showExecLine(lineNo) {
  if (!view) return;
  const effects = [setExecLineEffect.of(lineNo || null)];
  if (lineNo && lineNo <= view.state.doc.lines) {
    effects.push(EditorView.scrollIntoView(view.state.doc.line(lineNo).from, { y: 'nearest' }));
  }
  view.dispatch({ effects });
}

function showErrorInEditor(info) {
  if (!view) return;
  const effects = [setErrorEffect.of(info)];
  if (info?.line && info.line <= view.state.doc.lines) {
    effects.push(EditorView.scrollIntoView(view.state.doc.line(info.line).from, { y: 'center' }));
  }
  view.dispatch({ effects });
}

// Tactical Deep Space Flight Computer CodeMirror Theme
const customEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '15px',
    backgroundColor: '#070a13',
    color: '#e2e8f0',
    fontFamily: 'var(--font-mono)'
  },
  '.cm-content': {
    caretColor: '#00e5ff',
    padding: '10px 0',
    lineHeight: '1.6'
  },
  '.cm-gutters': {
    backgroundColor: '#05080f',
    color: '#475569',
    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
    paddingLeft: '4px'
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#00e5ff',
    borderLeftWidth: '2px',
    boxShadow: '0 0 8px rgba(0, 229, 255, 0.8)'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(0, 229, 255, 0.22)'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.025)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    color: '#00e5ff',
    fontWeight: '700'
  },
  '.cm-exec-line': {
    backgroundColor: 'rgba(34, 211, 238, 0.22)',
    boxShadow: 'inset 4px 0 0 #22d3ee'
  },
  '.cm-error-line': {
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    boxShadow: 'inset 3px 0 0 #fbbf24'
  },
  '.cm-error-explain': {
    margin: '4px 12px 8px 12px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    color: '#78350f',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    lineHeight: '1.55',
    whiteSpace: 'normal'
  },
  '.cm-error-explain-title': {
    fontWeight: '700'
  },
  '.cm-error-explain-text': {
    marginTop: '2px'
  },
  '.cm-error-fix-btn': {
    marginTop: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #d97706',
    background: '#f59e0b',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer'
  }
}, { dark: true });

onMounted(() => {
  if (!editorParent.value) return;

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      EditorView.lineWrapping,
      errorLineField,
      execLineField,
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      bracketMatching(),
      closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      javascript(),
      oneDark,
      customEditorTheme,
      completionCompartment.of(createLevelCompletions(props.levelId)),
      keymap.of([
        { key: 'Mod-Enter', run: () => { emit('run'); return true; } },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          // 程式碼改了，舊的逐行追蹤就不準了
          if (levelStore.traceSteps.length > 0) levelStore.clearTrace();
          const newDoc = update.state.doc.toString();
          emit('update:modelValue', newDoc);
          emit('change', newDoc);
        }
      })
    ]
  });

  view = new EditorView({
    state,
    parent: editorParent.value
  });
  showErrorInEditor(levelStore.lastRunResult?.errorInfo || null);
});

// 逐行追蹤播放到第幾步，就亮那一行
watch(
  () => (levelStore.traceIndex === null ? null : levelStore.traceSteps[levelStore.traceIndex]?.line ?? null),
  (lineNo) => showExecLine(lineNo)
);

// 執行結果有行號時，把錯誤標在那一行
watch(() => levelStore.lastRunResult, (res) => {
  showErrorInEditor(res && !res.pass ? res.errorInfo || null : null);
});

// Update editor text when modelValue changes externally
watch(() => props.modelValue, (newVal) => {
  if (view && newVal !== view.state.doc.toString()) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newVal }
    });
  }
});

// Update autocompletions when level changes
watch(() => props.levelId, (newLevelId) => {
  if (view) {
    view.dispatch({
      effects: completionCompartment.reconfigure(createLevelCompletions(newLevelId))
    });
  }
});

onBeforeUnmount(() => {
  clearTimeout(confirmTimer);
  if (view) {
    view.destroy();
    view = null;
  }
});
</script>

<style scoped>
.code-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #070a13;
  overflow: hidden;
  position: relative;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  background: #090e1a;
  border-bottom: 1px solid var(--border-subtle);
  height: 38px;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  height: 100%;
}

.file-tab {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.75rem;
  height: 100%;
  background: #070a13;
  border-right: 1px solid var(--border-subtle);
  border-bottom: 2px solid var(--cyan-primary);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 600;
  color: #f1f5f9;
}

.icon-file {
  color: var(--cyan-primary);
}

.status-indicator {
  display: flex;
  align-items: center;
  margin-left: 0.2rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.shortcut-tip {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}

.btn-reset {
  padding: 0.22rem 0.55rem;
  font-size: 0.74rem;
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--border-subtle);
  color: var(--text-secondary);
}

.btn-reset:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.btn-reset.is-confirming {
  background: rgba(245, 158, 11, 0.2);
  border-color: #f59e0b;
  color: #fde68a;
}

.editor-viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

:deep(.cm-editor) {
  height: 100%;
}
</style>
