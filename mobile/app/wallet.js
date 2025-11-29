import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import WalletService from '../services/WalletService';

export default function Wallet() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const walletData = await WalletService.getWalletInfo();
      setAddress(walletData.address);
      
      const balanceData = await WalletService.getBalance(walletData.address);
      setBalance(balanceData.balance);
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWallet();
  };

  const formatBTC = (sats) => {
    return (sats / 100000000).toFixed(8);
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 12)}...${addr.substring(addr.length - 8)}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>{formatBTC(balance)} BTC</Text>
        <Text style={styles.balanceUSD}>≈ ${(balance * 0.0004).toFixed(2)} USD</Text>
        
        {/* Address */}
        <TouchableOpacity style={styles.addressContainer}>
          <Text style={styles.addressLabel}>Address:</Text>
          <Text style={styles.address}>{formatAddress(address)}</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/receive')}
        >
          <Text style={styles.actionIcon}>📥</Text>
          <Text style={styles.actionText}>Receive</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/send')}
        >
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionText}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/swap')}
        >
          <Text style={styles.actionIcon}>🔄</Text>
          <Text style={styles.actionText}>Swap</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={styles.tab}
          onPress={() => router.push('/runes')}
        >
          <Text style={styles.tabIcon}>🪙</Text>
          <Text style={styles.tabText}>Runes</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tab}
          onPress={() => router.push('/ordinals')}
        >
          <Text style={styles.tabIcon}>🖼️</Text>
          <Text style={styles.tabText}>Ordinals</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tab}
          onPress={() => router.push('/activity')}
        >
          <Text style={styles.tabIcon}>📜</Text>
          <Text style={styles.tabText}>Activity</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 100,
  },
  balanceCard: {
    margin: 20,
    padding: 30,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  balanceUSD: {
    color: '#10b981',
    fontSize: 16,
    marginBottom: 20,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  addressLabel: {
    color: '#666',
    fontSize: 12,
  },
  address: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    fontSize: 32,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  tab: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tabIcon: {
    fontSize: 28,
  },
  tabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});






