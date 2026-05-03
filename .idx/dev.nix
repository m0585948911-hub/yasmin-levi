
# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{pkgs}: {
  channel = "stable-24.11";

  packages = [
    pkgs.nodejs_20
    pkgs.zulu

    # Chromium for whatsapp-web.js / puppeteer
    pkgs.chromium
    pkgs.xvfb-run
    pkgs.glib
    pkgs.nss
    pkgs.gtk3
    pkgs.gbm
    pkgs.alsa-lib
    pkgs.xorg.libX11
    pkgs.xorg.libxcb
    pkgs.xorg.libXcomposite
    pkgs.xorg.libXdamage
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
  ];

  env = {};

  services.firebase.emulators = {
    detect = true;
    projectId = "demo-app";
    services = ["auth" "firestore"];
  };

  idx = {
    extensions = [];

    workspace = {
      onCreate = {
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
    };

    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}
