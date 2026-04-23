const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withPhoneMonitorModule(config) {
  // 1. Add service + permissions to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Add FOREGROUND_SERVICE permission
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    const permsToAdd = [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
      "android.permission.POST_NOTIFICATIONS",
    ];

    for (const perm of permsToAdd) {
      const exists = manifest["uses-permission"].some(
        (p) => p.$?.["android:name"] === perm
      );
      if (!exists) {
        manifest["uses-permission"].push({
          $: { "android:name": perm },
        });
      }
    }

    // Add foreground service to application
    const app = manifest.application?.[0];
    if (app) {
      if (!app.service) app.service = [];

      const serviceExists = app.service.some(
        (s) =>
          s.$?.["android:name"] ===
          "com.sarthak.focusos.monitor.PhoneMonitorService"
      );

      if (!serviceExists) {
        app.service.push({
          $: {
            "android:name": "com.sarthak.focusos.monitor.PhoneMonitorService",
            "android:enabled": "true",
            "android:exported": "false",
            "android:foregroundServiceType": "specialUse",
          },
          property: [
            {
              $: {
                "android:name":
                  "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
                "android:value": "Focus monitoring and app usage tracking",
              },
            },
          ],
        });
      }
    }

    return config;
  });

  // 2. Register PhoneMonitorPackage in MainApplication
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes("PhoneMonitorPackage")) {
      // Add import
      contents = contents.replace(
        "import expo.modules.ReactNativeHostWrapper",
        "import expo.modules.ReactNativeHostWrapper\nimport com.sarthak.focusos.monitor.PhoneMonitorPackage"
      );

      // Add to getPackages() — after existing custom packages
      if (contents.includes("add(UsageStatsPackage())")) {
        contents = contents.replace(
          "add(UsageStatsPackage())",
          "add(UsageStatsPackage())\n              add(PhoneMonitorPackage())"
        );
      } else if (contents.includes("add(DNDPackage())")) {
        contents = contents.replace(
          "add(DNDPackage())",
          "add(DNDPackage())\n              add(PhoneMonitorPackage())"
        );
      } else {
        contents = contents.replace(
          "// add(MyReactNativePackage())",
          "// add(MyReactNativePackage())\n              add(PhoneMonitorPackage())"
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });

  // 3. Copy native Java files
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const targetDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "java",
        "com",
        "sarthak",
        "focusos",
        "monitor"
      );
      const sourceDir = path.join(
        projectRoot,
        "modules",
        "phone-monitor",
        "android"
      );

      fs.mkdirSync(targetDir, { recursive: true });

      for (const file of [
        "PhoneMonitorService.java",
        "PhoneMonitorModule.java",
        "PhoneMonitorPackage.java",
      ]) {
        const src = path.join(sourceDir, file);
        const dest = path.join(targetDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
      return config;
    },
  ]);

  return config;
}

module.exports = withPhoneMonitorModule;
