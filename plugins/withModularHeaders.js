const { withDangerousMod, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withRNFirebaseFix = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        if (!podfileContent.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES')) {
          // Add $RNFirebaseAsStaticFramework at the top
          podfileContent = `$RNFirebaseAsStaticFramework = true\n\n${podfileContent}`;

          // Insert RNFB non-modular header fix into existing post_install block
          const rnfbFix = `
    # Fix RNFirebase non-modular header includes with static frameworks
    installer.pods_project.targets.each do |t|
      if ['RNFBApp', 'RNFBAuth', 'RNFBFirestore', 'RNFBStorage'].include?(t.name)
        t.build_configurations.each do |bc|
          bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
          other = bc.build_settings['OTHER_CFLAGS'] ||= ['$(inherited)']
          bc.build_settings['OTHER_CFLAGS'] = (other + ['-Wno-non-modular-include-in-framework-module']).uniq
        end
      end
    end`;

          podfileContent = podfileContent.replace(
            /(post_install do \|installer\|)/,
            `$1${rnfbFix}`
          );

          fs.writeFileSync(podfilePath, podfileContent);
        }
      }

      return config;
    },
  ]);

module.exports = createRunOncePlugin(
  withRNFirebaseFix,
  'with-rnfb-fix',
  '1.0.0'
);
