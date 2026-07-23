import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/app/AppContext';
import { RootShell } from './src/app/RootShell';

/**
 * TokenTracker: local-first LLM usage tracker.
 * No accounts, backend, or telemetry. Save and validate and Refresh send
 * credentials directly to the selected provider.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <RootShell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
