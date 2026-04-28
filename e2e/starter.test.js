describe('Example', () => {
    beforeAll(async () => {
        await device.launchApp();
    });

    beforeEach(async () => {
        await device.reloadReactNative();
    });

    it('should have welcome screen', async () => {
        // Expect welcome screen to be visible
        // This is a placeholder test to verify harness setup
        await expect(element(by.id('welcome-screen'))).toBeVisible();
    });
});
