const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withUsageStatsModule(config) {
  // 1. Add PACKAGE_USAGE_STATS permission to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }
    const hasPermission = manifest["uses-permission"].some(
      (p) =>
        p.$?.["android:name"] ===
        "android.permission.PACKAGE_USAGE_STATS"
    );
    if (!hasPermission) {
      manifest["uses-permission"].push({
        $: {
          "android:name": "android.permission.PACKAGE_USAGE_STATS",
          "tools:ignore": "ProtectedPermissions",
        },
      });
    }

    // Also ensure tools namespace exists on manifest root
    if (!manifest.$) manifest.$ = {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    return config;
  });

  // 2. Register UsageStatsPackage in MainApplication (Kotlin — SDK 54 pattern)
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes("UsageStatsPackage")) {
      // Add import
      contents = contents.replace(
        "import expo.modules.ReactNativeHostWrapper",
        "import expo.modules.ReactNativeHostWrapper\nimport com.sarthak.focusos.usagestats.UsageStatsPackage"
      );

      // Add to getPackages() apply block
      // If DNDPackage already added, add after it
      if (contents.includes("add(DNDPackage())")) {
        contents = contents.replace(
          "add(DNDPackage())",
          "add(DNDPackage())\n              add(UsageStatsPackage())"
        );
      } else {
        // Add in the comment block
        contents = contents.replace(
          "// Packages that cannot be autolinked yet can be added manually here, for example:\n              // add(MyReactNativePackage())",
          "// Packages that cannot be autolinked yet can be added manually here, for example:\n              // add(MyReactNativePackage())\n              add(UsageStatsPackage())"
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });

  // 3. Copy native Java files into android source
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
        "usagestats"
      );
      const sourceDir = path.join(projectRoot, "modules", "usage-stats", "android");

      fs.mkdirSync(targetDir, { recursive: true });

      for (const file of ["UsageStatsModule.java", "UsageStatsPackage.java"]) {
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

module.exports = withUsageStatsModule;
