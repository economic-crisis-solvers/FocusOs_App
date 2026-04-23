import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

const C = { BG: '#020407', GREEN: '#00FF94', DIM: '#00FF9415', TEXT: '#00FF9460', BORDER: '#00FF9425' };

export default function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { register, loginWithGoogle } = useAuth();

  const handleRegister = async () => {
    if (!name || !email || !password) { Alert.alert('ERROR', 'All fields required.'); return; }
    setLoading(true);
    try {
      await register(name, email, password);
      Alert.alert('REGISTERED', 'Check email to verify account.', [
        { text: 'OK', onPress: () => navigation.replace('Login') }
      ]);
    } catch (e: any) {
      Alert.alert('REG FAILED', e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (e: any) {
      Alert.alert('OAUTH ERROR', e.message || 'Google login failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.gridLine, { top: `${i * 20}%` as any }]} />
      ))}

      <View style={styles.content}>
        <View style={styles.logoBlock}>
          <View style={styles.logoCornerTL} />
          <View style={styles.logoCornerBR} />
          <Text style={styles.logoText}>FOCUS<Text style={styles.logoDim}>OS</Text></Text>
          <Text style={styles.logoSub}>CREATE NEW OPERATOR PROFILE</Text>
        </View>

        <View style={styles.formBlock}>
          <Text style={styles.formLabel}>// NEW REGISTRATION</Text>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>DISPLAY_NAME</Text>
            <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor="#00FF9220" value={name} onChangeText={setName} />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>EMAIL_ADDR</Text>
            <TextInput style={styles.input} placeholder="user@domain.com" placeholderTextColor="#00FF9220" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TextInput style={styles.input} placeholder="min 6 characters" placeholderTextColor="#00FF9220" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={loading}>
            <Text style={styles.primaryBtnText}>{loading ? 'CREATING PROFILE...' : '[ CREATE ACCOUNT ]'}</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin} disabled={googleLoading}>
            <Text style={styles.googleBtnText}>{googleLoading ? 'REDIRECTING...' : '[ G ] GOOGLE AUTH'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.replace('Login')}>
            <Text style={styles.linkText}>HAVE ACCOUNT? LOGIN →</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusBar}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>ENCRYPTION ACTIVE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 30 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#00FF9406' },
  content: { flex: 1, justifyContent: 'center', gap: 40 },
  logoBlock: { alignItems: 'center', position: 'relative', paddingVertical: 20 },
  logoCornerTL: { position: 'absolute', top: 0, left: 0, width: 16, height: 16, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#00FF9440' },
  logoCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#00FF9440' },
  logoText: { color: C.GREEN, fontSize: 36, fontWeight: '900', letterSpacing: 6 },
  logoDim: { color: '#00FF9430' },
  logoSub: { color: '#00FF9440', fontSize: 9, letterSpacing: 3, marginTop: 6 },
  formBlock: { gap: 14 },
  formLabel: { color: '#00FF9440', fontSize: 10, letterSpacing: 3, marginBottom: 4 },
  inputWrap: { gap: 4 },
  inputLabel: { color: '#00FF9450', fontSize: 8, letterSpacing: 3 },
  input: { backgroundColor: '#00FF9408', borderWidth: 1, borderColor: '#00FF9425', color: C.GREEN, padding: 14, borderRadius: 4, fontSize: 13, letterSpacing: 1 },
  primaryBtn: { backgroundColor: C.GREEN, padding: 16, borderRadius: 4, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: C.BG, fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#00FF9415' },
  dividerText: { color: '#00FF9430', fontSize: 10 },
  googleBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#00FF9430', padding: 15, borderRadius: 4, alignItems: 'center' },
  googleBtnText: { color: '#00FF9080', fontWeight: '700', fontSize: 12, letterSpacing: 2 },
  linkBtn: { alignItems: 'center', padding: 8 },
  linkText: { color: '#00FF9440', fontSize: 10, letterSpacing: 2 },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.GREEN },
  statusText: { color: '#00FF9030', fontSize: 8, letterSpacing: 1 },
});
