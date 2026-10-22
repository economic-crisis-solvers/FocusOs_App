const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withDNDModule(config) {
  // 1. Add ACCESS_NOTIFICATION_POLICY permission to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }
    const hasPermission = manifest["uses-permission"].some(
      (p) =>
        p.$?.["android:name"] ===
        "android.permission.ACCESS_NOTIFICATION_POLICY"
    );
    if (!hasPermission) {
      manifest["uses-permission"].push({
        $: { "android:name": "android.permission.ACCESS_NOTIFICATION_POLICY" },
      });
    }
    return config;
  });

  // 2. Register DNDPackage in MainApplication (Kotlin — SDK 54 pattern)
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // Only modify if not already added
    if (!contents.includes("DNDPackage")) {
      // Add import at top (after last import line)
      contents = contents.replace(
        "import expo.modules.ReactNativeHostWrapper",
        "import expo.modules.ReactNativeHostWrapper\nimport com.sarthak.focusos.dnd.DNDPackage"
      );

      // Add to getPackages() — SDK 54 Kotlin uses PackageList(this).packages.apply { }
      // We add inside the apply block
      contents = contents.replace(
        "// Packages that cannot be autolinked yet can be added manually here, for example:\n              // add(MyReactNativePackage())",
        "// Packages that cannot be autolinked yet can be added manually here, for example:\n              // add(MyReactNativePackage())\n              add(DNDPackage())"
      );
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
        "dnd"
      );
      const sourceDir = path.join(projectRoot, "modules", "dnd", "android");

      fs.mkdirSync(targetDir, { recursive: true });

      for (const file of ["DNDModule.java", "DNDPackage.java"]) {
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

module.exports = withDNDModule;
