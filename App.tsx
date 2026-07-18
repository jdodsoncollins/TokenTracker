import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/app/AppContext';
import { RootShell } from './src/app/RootShell';

/**
 * TokenTracker — local-first LLM usage tracker.
 * No accounts, no backend, no analytics. Credentials never leave the device
 * except as direct HTTPS calls to the providers you choose.
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
