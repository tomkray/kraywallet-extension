import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

export default function Home() {
  const router = useRouter();
  const [hasWallet, setHasWallet] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkWallet();
  }, []);

  const checkWallet = async () => {
    try {
      const wallet = await SecureStore.getItemAsync('wallet_encrypted');
      setHasWallet(!!wallet);
    } catch (error) {
      console.error('Error checking wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Image 
          source={require('../app-icon.png')} 
          style={styles.logoLarge}
          resizeMode="contain"
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Logo */}
      <Image 
        source={require('../app-icon.png')} 
        style={styles.logoLarge}
        resizeMode="contain"
      />
      
      {/* Title */}
      <Text style={styles.title}>KrayWallet</Text>
      <Text style={styles.subtitle}>
        Bitcoin • Ordinals • Runes
      </Text>
      
      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {hasWallet ? (
          <>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => router.push('/unlock')}
            >
              <Text style={styles.primaryButtonText}>🔓 Unlock Wallet</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => router.push('/import')}
            >
              <Text style={styles.secondaryButtonText}>Import Wallet</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => router.push('/create')}
            >
              <Text style={styles.primaryButtonText}>🔐 Create Wallet</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => router.push('/import')}
            >
              <Text style={styles.secondaryButtonText}>Import Existing</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* Footer */}
      <Text style={styles.footer}>
        Self-custodial • Secure • Private
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logoLarge: {
    width: 180,
    height: 180,
    marginBottom: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 60,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#10b981',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: '#666',
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 20,
  },
});






