import { SymbolView } from 'expo-symbols';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  background: '#050B15',
  surface: '#101A29',
  border: '#1D293A',
  red: '#F12B3D',
  text: '#FFFFFF',
  muted: '#94A3B8',
};

export default function AccountScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ABSOLUTE CINEMA</Text>
        <Text style={styles.title}>Akun</Text>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <SymbolView
              name={{ ios: 'person.fill', android: 'person', web: 'person' }}
              tintColor={COLORS.muted}
              size={30}
            />
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.guestTitle}>Mode tamu</Text>
            <Text style={styles.guestSubtitle}>Anda belum masuk ke akun.</Text>
          </View>
        </View>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Akun belum tersedia</Text>
          <Text style={styles.noticeText}>
            Fitur masuk dan sinkronisasi profil belum dihubungkan pada aplikasi ini.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  eyebrow: { color: COLORS.red, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: '900', marginTop: 8 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  avatar: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: '#1D293A',
  },
  profileCopy: { flex: 1, marginLeft: 14 },
  guestTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  guestSubtitle: { color: COLORS.muted, fontSize: 13, marginTop: 4 },
  notice: {
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  noticeTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  noticeText: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
});