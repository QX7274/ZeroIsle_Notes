jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

describe('WebRTCService', () => {
  let WebRTCService;

  beforeEach(() => {
    jest.resetModules();
    ({ WebRTCService } = require('../webrtcService'));
  });

  it('会在先连房后开共享时给既有 peer connection 补挂本地轨道', async () => {
    const service = new WebRTCService();
    const videoTrack = { id: 'video-track-1', kind: 'video', stop: jest.fn() };
    const stream = { getTracks: jest.fn(() => [videoTrack]) };
    const peerConnection = {
      addTrack: jest.fn(),
      getSenders: jest.fn(() => []),
      removeTrack: jest.fn(),
    };

    service.isConnected = true;
    service.peerConnections = { viewerA: peerConnection };
    service._getScreenStream = jest.fn().mockResolvedValue(stream);
    service._createOffer = jest.fn().mockResolvedValue();

    await service.startScreenShare();

    expect(peerConnection.addTrack).toHaveBeenCalledWith(videoTrack, stream);
    expect(service._createOffer).toHaveBeenCalledWith('viewerA');
  });

  it('不会给已挂载的本地轨道重复 addTrack', () => {
    const service = new WebRTCService();
    const videoTrack = { id: 'video-track-1', kind: 'video', stop: jest.fn() };
    const stream = { getTracks: jest.fn(() => [videoTrack]) };
    const sender = { track: videoTrack };
    const peerConnection = {
      addTrack: jest.fn(),
      getSenders: jest.fn(() => [sender]),
      removeTrack: jest.fn(),
    };

    service.localStream = stream;

    service._syncLocalTracksForPeerConnection(peerConnection);

    expect(peerConnection.addTrack).not.toHaveBeenCalled();
    expect(peerConnection.removeTrack).not.toHaveBeenCalled();
  });

  it('停止共享后会从既有 peer connection 移除旧的本地轨道', () => {
    const service = new WebRTCService();
    const videoTrack = { id: 'video-track-1', kind: 'video', stop: jest.fn() };
    const sender = { track: videoTrack };
    const peerConnection = {
      addTrack: jest.fn(),
      getSenders: jest.fn(() => [sender]),
      removeTrack: jest.fn(),
    };

    service.localStream = { getTracks: jest.fn(() => [videoTrack]) };
    service.peerConnections = { viewerA: peerConnection };

    service.stopScreenShare();

    expect(videoTrack.stop).toHaveBeenCalled();
    expect(peerConnection.removeTrack).toHaveBeenCalledWith(sender);
  });
});
