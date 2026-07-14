const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const androidRoot = path.join(root, 'android');
const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
const configPath = path.join(root, 'capacitor.config.ts');

if (!fs.existsSync(manifestPath)) {
  throw new Error('AndroidManifest.xml não encontrado. Rode npx cap add android antes.');
}

let appId = 'com.studiorad.telemetriav3';
if (fs.existsSync(configPath)) {
  const config = fs.readFileSync(configPath, 'utf8');
  const match = config.match(/appId\s*:\s*['"]([^'"]+)['"]/);
  if (match) appId = match[1];
}

const javaDir = path.join(androidRoot, 'app', 'src', 'main', 'java', ...appId.split('.'));
const activityPath = path.join(javaDir, 'MainActivity.java');
fs.mkdirSync(javaDir, { recursive: true });

let manifest = fs.readFileSync(manifestPath, 'utf8');
const permissions = [
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
  '<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" android:usesPermissionFlags="neverForLocation" />'
];
for (const permission of permissions) {
  const name = permission.match(/android:name="([^"]+)"/)[1];
  if (!manifest.includes(`android:name="${name}"`)) {
    manifest = manifest.replace('<application', `${permission}\n    <application`);
  }
}
fs.writeFileSync(manifestPath, manifest);

const activity = `package ${appId};

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int LOCAL_NETWORK_PERMISSION_REQUEST = 33741;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestLocalNetworkPermissionIfNeeded();
    }

    private void requestLocalNetworkPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.NEARBY_WIFI_DEVICES) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                new String[]{Manifest.permission.NEARBY_WIFI_DEVICES},
                LOCAL_NETWORK_PERMISSION_REQUEST
            );
        }
    }
}
`;
fs.writeFileSync(activityPath, activity);

console.log('Permissão de rede local aplicada:', appId);
console.log('Mantidas apenas INTERNET, ACCESS_NETWORK_STATE e NEARBY_WIFI_DEVICES.');
