// test-device.ts
import { parseArgs } from "util";
import { createDevice } from "./lib/factory";

// テストしたいデバイス定義をインポート
import { pjLinkDef } from "./lib/devices/PjLinkDevice";
import { brightSignDef } from "./lib/devices/BrightSignDevice";
// import { templateDef } from "./lib/devices/_templateDevice";

// CLI引数のパース
const { values } = parseArgs({
  args: Bun.argv,
  options: {
    ip: { type: "string" },
    type: { type: "string" },
    key: { type: "string", default: "power" },
    val: { type: "string", default: "?" },
  },
  strict: true,
  allowPositionals: true,
});

if (!values.ip || !values.type) {
  console.error("❌ Usage: bun run test-device.ts --ip <IP_ADDRESS> --type <DEVICE_TYPE> [--key <STATE_KEY>] [--val <VALUE_OR_?>]");
  console.error("💡 Example: bun run test-device.ts --ip 192.168.1.100 --type PjLinkDevice --key power --val ?");
  process.exit(1);
}

// 登録されているデバイス定義のリストから検索
const definitions = [pjLinkDef, brightSignDef /*, templateDef */];
const def = definitions.find(d => d.type === values.type);

if (!def) {
  console.error(`❌ Unknown device type: ${values.type}`);
  process.exit(1);
}

console.log(`\n🚀 Testing Device: ${def.type} at ${values.ip}:${def.defaultPort}`);
console.log(`🎯 Target State : [${values.key}] -> ${values.val}`);
console.log("-".repeat(50));

// デバイスインスタンスの生成
const device = createDevice(def, { id: "test-id", ip: values.ip! });

async function runTest() {
  const task = device.translate(values.key!, values.val!);
  
  if (!task) {
    console.error(`❌ No translation found for key: '${values.key}', value: '${values.val}'`);
    return;
  }

  try {
    console.log(`📡 Sending command...`);
    const rawResponse = await task.execute();

    if (rawResponse === null) {
      console.log(`✅ Success (No response expected / UDP)`);
      return;
    }

    console.log(`📩 Raw Response: ${JSON.stringify(rawResponse)}`);

    if (device.checkError(rawResponse)) {
      console.error(`⚠️ Device reported an ERROR.`);
    } else if (values.val === "?") {
      const parsed = device.parseResponse(values.key!, rawResponse);
      console.log(`🧠 Parsed State: ${parsed}`);
    }

  } catch (error: any) {
    console.error(`❌ Network or Execution Error:`, error.message);
  }
}

runTest();