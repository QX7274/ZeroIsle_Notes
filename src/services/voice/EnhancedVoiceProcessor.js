import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import realmService from '../database/realmService';


class EnhancedVoiceProcessor {
  constructor() {
    this.isInitialized = false;
    this.isRecording = false;
    this.isProcessing = false;

    // Voice processing configuration
    this.config = {
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      bufferSize: 4096,
      noiseSuppressionEnabled: true,
      echoCancellationEnabled: true,
      autoGainControlEnabled: true,
    };

    // Context awareness
    this.context = {
      currentScreen: null,
      selectedText: null,
      recentActions: [],
      userPreferences: {},
      conversationHistory: [],
    };

    // Performance optimization
    this.audioBuffers = [];
    this.processingQueue = [];
    this.streamingBuffer = new Float32Array(this.config.bufferSize);

    // Real-time processing
    this.realTimeProcessor = null;
    this.partialResults = [];
    this.confidenceThreshold = 0.7;

    // Voice profile learning
    this.userProfile = {
      voiceCharacteristics: null,
      vocabularyPreferences: new Map(),
      corrections: new Map(),
      adaptationData: {},
    };

    this.initialize();
  }

  /**
   * Initialize voice processing system
   */
  async initialize() {
    try {
      // Load user preferences and profile
      await this.loadUserProfile();

      // Initialize native voice modules
      await this.initializeNativeModules();

      // Set up real-time processing
      this.setupRealTimeProcessing();

      // Initialize context awareness
      this.initializeContextAwareness();

      this.isInitialized = true;
      console.log('Enhanced Voice Processor initialized successfully');

    } catch (error) {
      console.error('Voice processor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start voice recording with real-time processing
   * @param {Object} options - Recording options
   * @returns {Promise<string>} Recording session ID
   */
  async startRecording(options = {}) {
    if (!this.isInitialized) {
      throw new Error('Voice processor not initialized');
    }

    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      const sessionId = this.generateSessionId();

      // Configure recording with enhanced settings
      const recordingConfig = {
        ...this.config,
        ...options,
        sessionId,
        realTimeProcessing: options.realTime !== false,
        contextAware: options.contextAware !== false,
        noiseReduction: options.noiseReduction !== false,
      };

      // Start native recording
      if (Platform.OS === 'ios') {
        await NativeModules.VoiceRecorder.startRecording(recordingConfig);
      } else if (Platform.OS === 'android') {
        await NativeModules.AndroidVoiceRecorder.startRecording(recordingConfig);
      }

      this.isRecording = true;
      this.currentSessionId = sessionId;

      // Start real-time processing if enabled
      if (recordingConfig.realTimeProcessing) {
        this.startRealTimeProcessing(sessionId);
      }

      return sessionId;

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and process final result
   * @returns {Promise<Object>} Processing result
   */
  async stopRecording() {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }

    try {
      // Stop native recording
      let audioData;
      if (Platform.OS === 'ios') {
        audioData = await NativeModules.VoiceRecorder.stopRecording();
      } else if (Platform.OS === 'android') {
        audioData = await NativeModules.AndroidVoiceRecorder.stopRecording();
      }

      this.isRecording = false;

      // Stop real-time processing
      this.stopRealTimeProcessing();

      // Process final audio with context
      const result = await this.processAudioWithContext(audioData, this.context);

      // Learn from the interaction
      await this.learnFromInteraction(result);

      return result;

    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  /**
   * Process audio with context awareness
   * @param {Object} audioData - Audio data from recording
   * @param {Object} context - Current context information
   * @returns {Promise<Object>} Processing result
   */
  async processAudioWithContext(audioData, context) {
    try {
      this.isProcessing = true;

      // Enhance audio quality
      const enhancedAudio = await this.enhanceAudioQuality(audioData);

      // Transcribe with context
      const transcription = await this.transcribeWithContext(enhancedAudio, context);

      // Analyze intent with context
      const intentAnalysis = await this.analyzeIntentWithContext(
        transcription.text,
        context
      );

      // Execute context-aware action
      const actionResult = await this.executeContextualAction(
        intentAnalysis,
        context
      );

      const result = {
        sessionId: this.currentSessionId,
        transcription,
        intentAnalysis,
        actionResult,
        context: context,
        timestamp: Date.now(),
        processingTime: Date.now() - this.processingStartTime,
      };

      this.isProcessing = false;
      return result;

    } catch (error) {
      this.isProcessing = false;
      console.error('Audio processing failed:', error);
      throw error;
    }
  }

  /**
   * Real-time audio processing for live feedback
   * @param {string} sessionId - Recording session ID
   */
  startRealTimeProcessing(sessionId) {
    this.realTimeProcessor = setInterval(async () => {
      try {
        // Get current audio buffer
        const audioChunk = await this.getCurrentAudioChunk();

        if (audioChunk && audioChunk.length > 0) {
          // Process chunk for partial results
          const partialResult = await this.processAudioChunk(audioChunk);

          if (partialResult.confidence > this.confidenceThreshold) {
            this.emitPartialResult(partialResult);
          }
        }

      } catch (error) {
        console.warn('Real-time processing error:', error);
      }
    }, 500); // Process every 500ms
  }

  /**
   * Stop real-time processing
   */
  stopRealTimeProcessing() {
    if (this.realTimeProcessor) {
      clearInterval(this.realTimeProcessor);
      this.realTimeProcessor = null;
    }
  }

  /**
   * Transcribe audio with context awareness
   * @param {Object} audioData - Enhanced audio data
   * @param {Object} context - Context information
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeWithContext(audioData, context) {
    try {
      // Prepare context-enhanced request
      const transcriptionRequest = {
        audio: audioData,
        language: context.preferredLanguage || 'auto',
        context: {
          previousText: context.selectedText || '',
          currentScreen: context.currentScreen,
          recentActions: context.recentActions.slice(-5),
          domainVocabulary: this.getDomainVocabulary(context),
        },
        userProfile: this.userProfile,
      };

      // Call enhanced transcription service
      const result = await this.callTranscriptionService(transcriptionRequest);

      // Post-process with user corrections
      const correctedResult = await this.applyUserCorrections(result);

      return {
        text: correctedResult.text,
        confidence: correctedResult.confidence,
        alternatives: correctedResult.alternatives || [],
        language: correctedResult.language,
        processingTime: correctedResult.processingTime,
      };

    } catch (error) {
      console.error('Transcription failed:', error);
      throw error;
    }
  }

  /**
   * Analyze intent with context awareness
   * @param {string} text - Transcribed text
   * @param {Object} context - Context information
   * @returns {Promise<Object>} Intent analysis result
   */
  async analyzeIntentWithContext(text, context) {
    try {
      // Extract intent with context
      const intentClassifier = await this.getIntentClassifier();

      const analysis = await intentClassifier.classify(text, {
        context: context,
        userHistory: this.context.conversationHistory,
        currentState: this.getCurrentAppState(),
      });

      return {
        intent: analysis.intent,
        confidence: analysis.confidence,
        entities: analysis.entities || [],
        parameters: analysis.parameters || {},
        contextualRelevance: analysis.contextualRelevance || 0.5,
      };

    } catch (error) {
      console.error('Intent analysis failed:', error);
      return {
        intent: 'unknown',
        confidence: 0,
        entities: [],
        parameters: {},
        contextualRelevance: 0,
      };
    }
  }

  /**
   * Execute contextual action based on intent
   * @param {Object} intentAnalysis - Intent analysis result
   * @param {Object} context - Context information
   * @returns {Promise<Object>} Action result
   */
  async executeContextualAction(intentAnalysis, context) {
    try {
      const { intent, parameters, entities } = intentAnalysis;

      switch (intent) {
        case 'create_note':
          return await this.createNoteAction(parameters, context);

        case 'search_notes':
          return await this.searchNotesAction(parameters, context);

        case 'ai_process':
          return await this.aiProcessAction(parameters, context);

        case 'navigation':
          return await this.navigationAction(parameters, context);

        case 'voice_command':
          return await this.executeVoiceCommand(parameters, context);

        default:
          return {
            success: false,
            message: 'Intent not recognized or not implemented',
            intent: intent,
          };
      }

    } catch (error) {
      console.error('Action execution failed:', error);
      return {
        success: false,
        error: error.message,
        intent: intentAnalysis.intent,
      };
    }
  }

  /**
   * Enhance audio quality with noise reduction and optimization
   * @param {Object} audioData - Raw audio data
   * @returns {Promise<Object>} Enhanced audio data
   */
  async enhanceAudioQuality(audioData) {
    try {
      // Apply noise reduction
      const denoised = await this.applyNoiseReduction(audioData);

      // Normalize audio levels
      const normalized = await this.normalizeAudioLevels(denoised);

      // Apply echo cancellation
      const echoCancelled = await this.applyEchoCancellation(normalized);

      return echoCancelled;

    } catch (error) {
      console.warn('Audio enhancement failed, using original:', error);
      return audioData;
    }
  }

  /**
   * Learn from user interactions and corrections
   * @param {Object} result - Processing result
   */
  async learnFromInteraction(result) {
    try {
      // Update conversation history
      this.context.conversationHistory.push({
        timestamp: Date.now(),
        transcription: result.transcription.text,
        intent: result.intentAnalysis.intent,
        success: result.actionResult.success,
      });

      // Limit history size
      if (this.context.conversationHistory.length > 100) {
        this.context.conversationHistory = this.context.conversationHistory.slice(-50);
      }

      // Learn vocabulary preferences
      if (result.transcription.text) {
        this.updateVocabularyPreferences(result.transcription.text);
      }

      // Save updated profile
      await this.saveUserProfile();

    } catch (error) {
      console.warn('Learning from interaction failed:', error);
    }
  }

  /**
   * Load user voice profile from storage
   */
  async loadUserProfile() {
    try {
      const profileData = await AsyncStorage.getItem('voice_user_profile');
      if (profileData) {
        this.userProfile = { ...this.userProfile, ...JSON.parse(profileData) };
      }

      const contextData = await AsyncStorage.getItem('voice_context');
      if (contextData) {
        this.context = { ...this.context, ...JSON.parse(contextData) };
      }

    } catch (error) {
      console.warn('Failed to load user profile:', error);
    }
  }

  /**
   * Save user voice profile to storage
   */
  async saveUserProfile() {
    try {
      await AsyncStorage.setItem('voice_user_profile', JSON.stringify(this.userProfile));
      await AsyncStorage.setItem('voice_context', JSON.stringify({
        userPreferences: this.context.userPreferences,
        conversationHistory: this.context.conversationHistory.slice(-20), // Save last 20 interactions
      }));

    } catch (error) {
      console.warn('Failed to save user profile:', error);
    }
  }

  /**
   * Update context with current app state
   * @param {Object} newContext - New context information
   */
  updateContext(newContext) {
    this.context = { ...this.context, ...newContext };
  }

  /**
   * Get voice processing statistics
   * @returns {Object} Processing statistics
   */
  getProcessingStats() {
    return {
      isInitialized: this.isInitialized,
      isRecording: this.isRecording,
      isProcessing: this.isProcessing,
      conversationHistory: this.context.conversationHistory.length,
      vocabularySize: this.userProfile.vocabularyPreferences.size,
      correctionsCount: this.userProfile.corrections.size,
      realTimeEnabled: this.realTimeProcessor !== null,
    };
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `voice_session_${realmService.createObjectId()}`;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopRealTimeProcessing();

    if (this.isRecording) {
      this.stopRecording().catch(console.error);
    }

    this.audioBuffers = [];
    this.processingQueue = [];
    this.partialResults = [];
  }
}

export default new EnhancedVoiceProcessor();
