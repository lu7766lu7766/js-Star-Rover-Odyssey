/**
 * Level 8: 星際氣象站
 * 核心概念：API 與外部資料交換、JSON 物件解析、多站點氣候決策
 */

import { DRONE_FLIGHT_LIMITS, WEATHER_STATIONS, BENCHMARK_STATION_DATA, resolveJsonPath, evaluateTelemetry } from '../services/weatherService.js';

export const LEVEL_8_STARTER_CODE = `// 星際氣象站
async function evaluateAndLaunch(stationId) {   // @param {string} stationId 觀測站 id
  const data = await fetchStation(___);   // @type {string} 觀測站 id

  const wind = data.___;                  // @type {number} 風速
  const temp = data.___;                  // @type {number} 氣溫
  const rainProb = data.___;              // @type {number} 降水機率

  if (___) {   // 總和條件安全判斷，且(&&)，或(||)
    drone.launch(___);   // @type {string} 發射站點（跟 fetch 同一站）
  } else {
    drone.abortMission();
  }
}

// 發射站點 id
// station-tpe：台北 
// station-tyo：東京 
// station-lon：倫敦 
// station-dxb：杜拜 
// station-rkv：雷克雅維克 
evaluateAndLaunch(___);   // @type {string} 發射站點 id
`;

const CORRECT_PATHS = {
  windPath: 'current.wind_speed_10m',
  tempPath: 'current.temperature_2m',
  precipPath: 'hourly.precipitation_probability[0]'
};

function stationName(id) {
  return WEATHER_STATIONS.find((s) => s.id === id)?.name || id || '當前基地';
}

export default {
  id: 8,
  title: '星際氣象站',
  subtitle: 'API 與 JSON 資料解析',
  conceptTitle: '連結世界：透過 API 交換資料與解析 JSON 結構',
  concepts: ['Web API (fetch)', 'JSON 物件樹與屬性取值', '非同步資料交換 (Async/Await)', '多站點氣候安全決策'],
  description: `高空探測無人機準備升空進行行星高層大氣測繪！然而無人機具備嚴格的航太硬體安全極限（風速 ≤ 25 km/h、降雨 ≤ 20%、氣溫 ≥ 0°C，三個都要過才 launch，否則 abort）。我們需要向「星際氣象 API (Open-Meteo)」請求真實即時大氣 JSON 資料。沙箱已內建 API，直接呼叫不用 import：fetchStation(stationId) 回傳該站氣象 JSON（非同步，前面一定要加 await）；drone.launch(stationId) / drone.abortMission() 發射或中止（launch 要傳跟 fetch 同一站）。fetchStation 回傳的 data 就是下方「API 回傳原始 JSON 物件樹」那一份：最外層有 current 物件（風速、氣溫等數字鍵）和 hourly 物件（降水機率陣列等），鍵名不用背，照著 JSON 樹層級用 data.層級.鍵名寫出，陣列要加 [0]，取出的風速 / 氣溫 / 降水皆為數字（路徑寫法，不是字串，不加引號）。請檢視 API 回傳的樹狀結構，為無人機感測器配置正確的取值路徑，並比對全球 5 大觀測基地（station-tpe / station-tyo / station-lon / station-dxb / station-rkv，先比對 5 站數據再選），找出唯一符合全安全窗口的基地派遣無人機升空！站點 id 為字串（加引號），安全判斷用 wind、rainProb、temp 以 && 串起三合一條件。`,
  targetRequirements: [
    '點擊「發送 API 請求」向全球氣象站獲取原始 JSON 資料',
    '配置風速感測器屬性路徑 (current.wind_speed_10m)',
    '配置氣溫感測器屬性路徑 (current.temperature_2m)',
    '配置降水感測器屬性路徑 (hourly.precipitation_probability[0])',
    '分析各站大氣數據，選定全安全基地（風速 ≤ 25 km/h、降水 ≤ 20%、氣溫 ≥ 0°C）派遣升空'
  ],
  controlType: 'weather-api',
  flightLimits: DRONE_FLIGHT_LIMITS,
  defaultBindings: {
    windPath: '',
    tempPath: '',
    precipPath: ''
  },
  hints: [
    '提示 1【JSON 樹與點運算子】：API 回傳的資料是巢狀物件。想要取得 current 物件內的 wind_speed_10m，在 JavaScript 中使用點運算子寫作 current.wind_speed_10m。',
    '提示 2【陣列索引取值】：降水機率存放在 hourly 物件底下的陣列中，若要取得當前第 0 小時的預報值，使用中括號索引 hourly.precipitation_probability[0]。',
    '提示 3【全球航區決策】：切換全球觀測站比對氣候：東京風速高達 38 km/h 會吹翻機體、倫敦降雨高達 85% 易短路、雷克雅維克氣溫 -6°C 會結冰墜毀！請選定台北或杜拜等溫和基地發射。'
  ],
  jsCodeExample: `// 💡 JavaScript 對照：用 async/await 呼叫 API 並以點運算子解析 JSON
// 本關沙箱把「發請求＋解析」包成一個函式 fetchStation(stationId)，直接回傳 JSON 物件
// 現實世界的寫法是兩段式：await fetch(url) 再 await response.json()，觀念完全一樣
async function evaluateAndLaunchDrone(stationId) {
  // 1. 發送請求並等待回傳（沙箱版：一行搞定；現實版：fetch + .json() 兩行）
  const data = await fetchStation(stationId);

  // 3. 依據 JSON 物件屬性路徑提取感測器數值（鍵名照下方 JSON 樹寫）
  const wind = data.current.wind_speed_10m;                  // 風速 (km/h)
  const temp = data.current.temperature_2m;                   // 氣溫 (°C)
  const rainProb = data.hourly.precipitation_probability[0];  // 降雨機率 (%)

  // 4. 嚴格航太安全規範複合判斷 (AND 邏輯)
  if (wind <= 25 && rainProb <= 20 && temp >= 0) {
    drone.launch(stationId);
  } else {
    drone.abortMission();
  }
}`,
  conceptExplanation: `在現代網路軟體架構中，**API (應用程式介面)** 是系統之間溝通的標準橋樑，而 **JSON (JavaScript Object Notation)** 則是傳遞資料的通用格式。本關沙箱把取數包裝成 \`await fetchStation(stationId)\`（直接回傳 JSON 物件，結構就是下方那棵 JSON 樹）；現實世界則是兩段式 \`await fetch(url)\` ＋ \`await response.json()\`，觀念相同。拿到資料樹後，再使用**點運算子 (如 data.current.wind_speed_10m)** 與**陣列索引 (如 [0])** 精準提取所需的數值！`,
  starterCode: LEVEL_8_STARTER_CODE,
  validate: (runResult) => {
    // 新鏈路：Worker 真跑 fetchStation + drone.launch/abort 的 trace
    if (runResult.apiCalls && Array.isArray(runResult.apiCalls)) {
      const code = runResult.code || '';
      const fetches = runResult.apiCalls
        .filter((c) => c.api === 'fetchStation')
        .map((c) => c.args[0]);
      const launches = runResult.apiCalls
        .filter((c) => c.api === 'drone.launch')
        .map((c) => c.args[0]);

      // 1. 感測器路徑必須手寫進程式碼（擋「直接 launch 安全基地」的抄捷徑）
      const needKeys = ['wind_speed_10m', 'temperature_2m', 'precipitation_probability'];
      const missingKeys = needKeys.filter((k) => !code.includes(k));
      if (missingKeys.length > 0) {
        return {
          pass: false,
          failReason: 'DISCONNECT',
          error: `感測器取值路徑沒寫進程式碼！缺了 ${missingKeys.join('、')}。請從 data 用點運算子取出三個數值（例如 data.current.wind_speed_10m），不能跳過解析直接發射！`
        };
      }

      if (fetches.length === 0) {
        return {
          pass: false,
          failReason: 'DISCONNECT',
          error: '沒有呼叫 fetchStation！請先 await fetchStation("station-...") 取回氣象 JSON，再解析判斷。'
        };
      }

      // 2. 只 abort 沒 launch：判斷對了但任務沒完成 → 引導換站
      if (launches.length === 0) {
        const lastFetch = fetches[fetches.length - 1];
        const data = BENCHMARK_STATION_DATA[lastFetch];
        if (data) {
          const t = evaluateTelemetry(data, CORRECT_PATHS);
          if (!t.canLaunch) {
            return {
              pass: false,
              failReason: t.failReason,
              error: `【${stationName(lastFetch)}】確實不安全（${t.summary}），你的 abort 正確！但任務是找到安全基地發射——換一站（提示：台北 / 杜拜）再試。`
            };
          }
        }
        return {
          pass: false,
          failReason: 'DISCONNECT',
          error: '資料安全卻還沒發射！確認三項全過後，呼叫 drone.launch("station-...") 派遣無人機升空。'
        };
      }

      // 3. 發射的基地必須是本次 fetch 過的（擋「fetch 一站、亂槍發射另一站」）
      const stationId = launches[launches.length - 1];
      if (!fetches.includes(stationId)) {
        return {
          pass: false,
          failReason: 'DISCONNECT',
          error: `發射了 ${stationId}，但本次根本沒 fetch 它的資料！先 fetchStation("${stationId}") 拿到 JSON 再判斷，不能憑空發射。`
        };
      }

      const data = BENCHMARK_STATION_DATA[stationId];
      if (!data) {
        return {
          pass: false,
          failReason: 'DISCONNECT',
          error: `未知觀測站 "${stationId}"！可用：station-tpe / station-tyo / station-lon / station-dxb / station-rkv。`
        };
      }

      // 4. 用正確路徑評估該站真實安規
      const t = evaluateTelemetry(data, CORRECT_PATHS);
      if (!t.canLaunch) {
        const reasonMsg = t.failReason === 'WIND'
          ? `【${stationName(stationId)}】風速高達 ${t.wind} km/h，超出 25 km/h 安全極限！強風將導致機體偏航翻滾。`
          : t.failReason === 'PRECIP'
            ? `【${stationName(stationId)}】降水機率高達 ${t.precip}%，超出 20% 防雨極限！儀器會受潮短路。`
            : `【${stationName(stationId)}】氣溫僅 ${t.temp}°C，低於 0°C 防結冰極限！機翼會結霜墜毀。`;
        return {
          pass: false,
          failReason: t.failReason,
          data: { station: stationName(stationId), wind: t.wind, temp: t.temp, precip: t.precip },
          error: `${reasonMsg}請換安全基地（提示：台北 / 杜拜）重跑。`
        };
      }

      // 星級：async/await + console.log + && 複合判斷
      const hasAsync = code.includes('async') && code.includes('await');
      const hasLog = code.includes('console.log');
      const hasAnd = code.includes('&&');
      let stars, suffix;
      if (hasAsync && hasLog && hasAnd) {
        stars = 3;
        suffix = '（3星：async/await + 遙測 log + && 複合判斷，完整 API 流程！）';
      } else {
        stars = 2;
        suffix = '（2星：過關！補上 async/await、console.log 遙測與 && 複合判斷拿 3 星！）';
      }
      return {
        pass: true,
        data: { station: stationName(stationId), wind: t.wind, temp: t.temp, precip: t.precip, stars, fromCode: true },
        feedback: `API 遙測解析與基地決策大獲全勝！【${stationName(stationId)}】風速 ${t.wind} km/h、氣溫 ${t.temp}°C、降水 ${t.precip}% 均處於完美安全窗口，無人機穿破雲層完成高空行星測繪！${suffix}`
      };
    }

    const weatherSession = runResult.weatherSession || {};
    const {
      rawJson,
      paths = {},
      station = {},
      launched = false
    } = weatherSession;

    if (!rawJson) {
      return {
        pass: false,
        failReason: 'DISCONNECT',
        error: '尚未取得氣象 API 資料！請先點擊「發送 API 請求」向氣象站索取資料。'
      };
    }

    if (!launched) {
      return {
        pass: false,
        failReason: 'DISCONNECT',
        error: '氣象資料已接收，但尚未點擊「派遣無人機」執行發射！'
      };
    }

    const { windPath = '', tempPath = '', precipPath = '' } = paths;

    // Evaluate JSON path extraction
    const windVal = resolveJsonPath(rawJson, windPath);
    const tempVal = resolveJsonPath(rawJson, tempPath);
    const precipVal = resolveJsonPath(rawJson, precipPath);

    const isWindValid = typeof windVal === 'number' && !isNaN(windVal);
    const isTempValid = typeof tempVal === 'number' && !isNaN(tempVal);
    const isPrecipValid = typeof precipVal === 'number' && !isNaN(precipVal);

    if (!isWindValid || !isTempValid || !isPrecipValid) {
      const errSensors = [];
      if (!isWindValid) errSensors.push(`風速感測器 (目前路徑: "${windPath || '(未填)'}")`);
      if (!isTempValid) errSensors.push(`氣溫感測器 (目前路徑: "${tempPath || '(未填)'}")`);
      if (!isPrecipValid) errSensors.push(`降水感測器 (目前路徑: "${precipPath || '(未填)'}")`);

      return {
        pass: false,
        failReason: 'DISCONNECT',
        error: `感測器路徑解析失敗！${errSensors.join('、')} 解析值為 undefined。請對照 JSON 物件樹輸入正確路徑（例如 current.wind_speed_10m）。`
      };
    }

    // Evaluate Aerospace Safety Limits
    if (windVal > DRONE_FLIGHT_LIMITS.maxWindSpeed) {
      return {
        pass: false,
        failReason: 'WIND',
        data: { station: station.name, wind: windVal, temp: tempVal, precip: precipVal },
        error: `【${station.name || '當前基地'}】風速高達 ${windVal} km/h，超出無人機 25 km/h 安全極限！強風將導致機體劇烈偏航失控翻滾。請更換其他風速平穩的觀測基地。`
      };
    }

    if (precipVal > DRONE_FLIGHT_LIMITS.maxPrecipitation) {
      return {
        pass: false,
        failReason: 'PRECIP',
        data: { station: station.name, wind: windVal, temp: tempVal, precip: precipVal },
        error: `【${station.name || '當前基地'}】降水機率高達 ${precipVal}%，超出無人機 20% 防雨極限！高空暴雨將導致精密探測儀器受潮短路。請更換乾燥無雨的基地。`
      };
    }

    if (tempVal < DRONE_FLIGHT_LIMITS.minTemperature) {
      return {
        pass: false,
        failReason: 'TEMP',
        data: { station: station.name, wind: windVal, temp: tempVal, precip: precipVal },
        error: `【${station.name || '當前基地'}】地表氣溫僅 ${tempVal}°C，低於無人機 0°C 防結冰極限！高空極寒將導致機翼與旋翼嚴重結霜失速墜毀。請選擇溫暖適宜的基地。`
      };
    }

    return {
      pass: true,
      data: {
        station: station.name,
        wind: windVal,
        temp: tempVal,
        precip: precipVal,
        isRealData: weatherSession.isRealData,
        stars: 2,
        fromCode: false
      },
      feedback: `API 遙測解析與基地決策大獲全勝！【${station.name}】風速 ${windVal} km/h、氣溫 ${tempVal}°C、降水 ${precipVal}% 均處於完美安全窗口，無人機穿破雲層完成高空行星測繪！（2星：表單模式上限，切「寫碼」手寫 async/await 拿 3 星）`
    };
  }
};
