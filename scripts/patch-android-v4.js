const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const xmlDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'xml');
const networkPath = path.join(xmlDir, 'network_security_config.xml');
const javaMain = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'rad', 'gt7telemetriav4', 'MainActivity.java');
const kotlinMain = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'rad', 'gt7telemetriav4', 'MainActivity.kt');

if (!fs.existsSync(manifestPath)) {
  console.error('AndroidManifest.xml não encontrado. Execute npx cap add android antes.');
  process.exit(1);
}

let manifest = fs.readFileSync(manifestPath, 'utf8');
const permissions = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_MULTICAST_STATE',
  'android.permission.WAKE_LOCK',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.RECEIVE_BOOT_COMPLETED'
];
for (const permission of permissions) {
  if (!manifest.includes(`android:name="${permission}"`)) {
    manifest = manifest.replace('<application', `    <uses-permission android:name="${permission}" />\n\n    <application`);
  }
}
if (!manifest.includes('android:usesCleartextTraffic="true"')) {
  manifest = manifest.replace('<application', '<application android:usesCleartextTraffic="true"');
}
if (!manifest.includes('android:networkSecurityConfig="@xml/network_security_config"')) {
  manifest = manifest.replace('<application', '<application android:networkSecurityConfig="@xml/network_security_config"');
}
if (!manifest.includes('android:windowLayoutInDisplayCutoutMode="shortEdges"')) {
  manifest = manifest.replace(
    /(<activity\b[^>]*android:name="(?:\.MainActivity|com\.rad\.gt7telemetriav4\.MainActivity)"[^>]*)(>)/,
    '$1 android:windowLayoutInDisplayCutoutMode="shortEdges"$2'
  );
}

fs.mkdirSync(xmlDir, { recursive: true });
fs.writeFileSync(networkPath, `<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n  <base-config cleartextTrafficPermitted="true">\n    <trust-anchors>\n      <certificates src="system" />\n      <certificates src="user" />\n    </trust-anchors>\n  </base-config>\n</network-security-config>\n`);
fs.writeFileSync(manifestPath, manifest);

fs.mkdirSync(path.dirname(javaMain), { recursive: true });
fs.writeFileSync(javaMain, `package com.rad.gt7telemetriav4;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    hideSystemUi();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) hideSystemUi();
  }

  private void hideSystemUi() {
    final View decorView = getWindow().getDecorView();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      getWindow().setDecorFitsSystemWindows(false);
      WindowInsetsController controller = decorView.getWindowInsetsController();
      if (controller != null) {
        controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      }
    } else {
      decorView.setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
          | View.SYSTEM_UI_FLAG_FULLSCREEN
          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      );
    }
  }
}
`);
if (fs.existsSync(kotlinMain)) fs.unlinkSync(kotlinMain);
console.log('Telemetria V4: HTTP local, rede, tela ativa e fullscreen imersivo aplicados.');
