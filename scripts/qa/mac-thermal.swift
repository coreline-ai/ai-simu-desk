import Foundation

// OS thermal pressure only. This is neither a Celsius sensor nor a phone measurement.
let process = ProcessInfo.processInfo
let value = process.thermalState.rawValue
let names = ["nominal", "fair", "serious", "critical"]
let result: [String: Any] = [
    "at": ISO8601DateFormatter().string(from: Date()),
    "state": value,
    "label": value >= 0 && value < names.count ? names[value] : "unknown",
    "lowPowerMode": process.isLowPowerModeEnabled
]
let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
