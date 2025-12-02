/**
 * KRAY SPACE L2 - Raft Consensus
 * 
 * Simplified Raft consensus for validator coordination
 * 
 * In Phase 1 (Federated launch), we use 3 trusted validators
 * with Raft consensus for leader election and log replication
 */

import { listActiveValidators, updateValidatorActivity } from './validatorNode.js';
import EventEmitter from 'events';

/**
 * Validator states in Raft
 */
const VALIDATOR_STATE = {
  FOLLOWER: 'follower',
  CANDIDATE: 'candidate',
  LEADER: 'leader'
};

/**
 * Raft Consensus Manager
 */
export class RaftConsensus extends EventEmitter {
  constructor(validatorId, validators = []) {
    super();
    
    this.validatorId = validatorId;
    this.validators = validators; // Other validator endpoints
    this.state = VALIDATOR_STATE.FOLLOWER;
    
    // Raft state
    this.currentTerm = 0;
    this.votedFor = null;
    this.log = [];
    this.commitIndex = 0;
    this.lastApplied = 0;
    
    // Leader state
    this.nextIndex = {};
    this.matchIndex = {};
    
    // Timeouts
    this.electionTimeout = null;
    this.heartbeatInterval = null;
    
    // Configuration
    this.HEARTBEAT_INTERVAL = 1000; // 1 second
    this.ELECTION_TIMEOUT_MIN = 3000; // 3 seconds
    this.ELECTION_TIMEOUT_MAX = 6000; // 6 seconds
    
    this.started = false;
  }

  /**
   * Start consensus protocol
   */
  start() {
    if (this.started) {
      return;
    }

    console.log(`\n🗳️  Starting Raft consensus...`);
    console.log(`   Validator ID: ${this.validatorId}`);
    console.log(`   Peers: ${this.validators.length}`);

    this.state = VALIDATOR_STATE.FOLLOWER;
    this.resetElectionTimeout();
    this.started = true;

    console.log(`✅ Consensus started as FOLLOWER`);
  }

  /**
   * Stop consensus
   */
  stop() {
    if (!this.started) {
      return;
    }

    console.log('🛑 Stopping consensus...');

    if (this.electionTimeout) {
      clearTimeout(this.electionTimeout);
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.started = false;
    console.log('✅ Consensus stopped');
  }

  /**
   * Reset election timeout
   */
  resetElectionTimeout() {
    if (this.electionTimeout) {
      clearTimeout(this.electionTimeout);
    }

    const timeout = this.ELECTION_TIMEOUT_MIN + 
      Math.random() * (this.ELECTION_TIMEOUT_MAX - this.ELECTION_TIMEOUT_MIN);

    this.electionTimeout = setTimeout(() => {
      this.startElection();
    }, timeout);
  }

  /**
   * Start leader election
   */
  startElection() {
    console.log('\n🗳️  Starting election...');

    this.state = VALIDATOR_STATE.CANDIDATE;
    this.currentTerm++;
    this.votedFor = this.validatorId;

    let votes = 1; // Vote for self
    const majority = Math.floor(this.validators.length / 2) + 1;

    console.log(`   Term: ${this.currentTerm}`);
    console.log(`   Need: ${majority} votes`);

    // In a real implementation, would request votes from other validators
    // For now, simplified: become leader if we're the first validator

    if (this.validatorId.endsWith('1') || votes >= majority) {
      this.becomeLeader();
    } else {
      this.resetElectionTimeout();
    }
  }

  /**
   * Become leader
   */
  becomeLeader() {
    console.log('\n👑 Becoming LEADER');

    this.state = VALIDATOR_STATE.LEADER;
    
    // Initialize leader state
    for (const validator of this.validators) {
      this.nextIndex[validator] = this.log.length;
      this.matchIndex[validator] = 0;
    }

    // Start sending heartbeats
    this.sendHeartbeats();

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
    }, this.HEARTBEAT_INTERVAL);

    this.emit('leader_elected', { validatorId: this.validatorId, term: this.currentTerm });
  }

  /**
   * Send heartbeats to followers
   */
  sendHeartbeats() {
    if (this.state !== VALIDATOR_STATE.LEADER) {
      return;
    }

    // console.log('   💓 Sending heartbeats...');

    // In real implementation, send AppendEntries RPC to all followers
    // For now, just update our own activity
    updateValidatorActivity(this.validatorId);

    // Emit heartbeat event
    this.emit('heartbeat', { term: this.currentTerm });
  }

  /**
   * Append entry to log (leader only)
   */
  appendEntry(entry) {
    if (this.state !== VALIDATOR_STATE.LEADER) {
      throw new Error('Only leader can append entries');
    }

    console.log(`\n📝 Leader appending entry...`);
    console.log(`   Type: ${entry.type}`);

    const logEntry = {
      term: this.currentTerm,
      index: this.log.length,
      entry,
      timestamp: Date.now()
    };

    this.log.push(logEntry);

    console.log(`✅ Entry appended at index ${logEntry.index}`);

    // In real implementation, replicate to followers
    // For now, immediately commit
    this.commitIndex = this.log.length - 1;

    this.emit('entry_appended', logEntry);

    return logEntry;
  }

  /**
   * Get current leader
   */
  getLeader() {
    if (this.state === VALIDATOR_STATE.LEADER) {
      return this.validatorId;
    }

    return null; // Unknown or no leader
  }

  /**
   * Is this node the leader?
   */
  isLeader() {
    return this.state === VALIDATOR_STATE.LEADER;
  }

  /**
   * Get consensus state
   */
  getState() {
    return {
      validator_id: this.validatorId,
      state: this.state,
      term: this.currentTerm,
      log_length: this.log.length,
      commit_index: this.commitIndex,
      is_leader: this.isLeader()
    };
  }
}

// Singleton instance
let consensusInstance = null;

/**
 * Initialize consensus
 */
export function initConsensus(validatorId, peerValidators = []) {
  if (consensusInstance) {
    console.log('   ℹ️  Consensus already initialized');
    return consensusInstance;
  }

  console.log('\n⚡ Initializing Raft consensus...');

  consensusInstance = new RaftConsensus(validatorId, peerValidators);
  consensusInstance.start();

  return consensusInstance;
}

/**
 * Get consensus instance
 */
export function getConsensus() {
  if (!consensusInstance) {
    throw new Error('Consensus not initialized. Call initConsensus() first.');
  }
  return consensusInstance;
}

/**
 * Stop consensus
 */
export function stopConsensus() {
  if (consensusInstance) {
    consensusInstance.stop();
    consensusInstance = null;
  }
}

export default {
  RaftConsensus,
  initConsensus,
  getConsensus,
  stopConsensus,
  VALIDATOR_STATE
};




















