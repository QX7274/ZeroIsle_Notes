describe('Smoke', () => {
    beforeAll(async () => {
        await device.launchApp({ newInstance: true });
    });

    beforeEach(async () => {
        await device.reloadReactNative();
    });

    it('should launch app and show home container', async () => {
        await expect(element(by.id('screen.home'))).toBeVisible();
    });

    it('should open AI entry from home', async () => {
        const aiEntry = element(by.id('entry.ai'));
        await expect(aiEntry).toBeVisible();
        await aiEntry.tap();
        await expect(element(by.id('screen.ai'))).toBeVisible();
        await expect(element(by.id('input.ai.message'))).toBeVisible();
        await expect(element(by.id('action.ai.send'))).toBeVisible();
    });

    it('should reach profile and reminder / knowledge graph entries', async () => {
        const profileTab = element(by.id('nav.tab.profile'));
        await expect(profileTab).toBeVisible();
        await profileTab.tap();

        await expect(element(by.id('screen.profile'))).toBeVisible();
        await expect(element(by.id('entry.reminder.profile'))).toBeVisible();
        await expect(element(by.id('entry.knowledgeGraph.profile'))).toBeVisible();
    });

    it('should open reminder screen from profile entry', async () => {
        await element(by.id('nav.tab.profile')).tap();
        await element(by.id('entry.reminder.profile')).tap();
        await expect(element(by.id('screen.reminderList'))).toBeVisible();
        await expect(element(by.id('action.reminder.add'))).toBeVisible();
    });

    it('should open knowledge graph from stable entry', async () => {
        await element(by.id('nav.tab.profile')).tap();
        await element(by.id('entry.knowledgeGraph.profile')).tap();
        await expect(element(by.id('screen.knowledgeGraph'))).toBeVisible();
        await expect(element(by.id('action.knowledgeGraph.analysis'))).toBeVisible();
    });

    it('should open knowledge analysis from graph toolbar', async () => {
        await element(by.id('nav.tab.profile')).tap();
        await element(by.id('entry.knowledgeGraph.profile')).tap();
        await element(by.id('action.knowledgeGraph.analysis')).tap();
        await expect(element(by.id('screen.knowledgeAnalysis'))).toBeVisible();
    });

    it('should open reminder create screen from list add button', async () => {
        await element(by.id('nav.tab.profile')).tap();
        await element(by.id('entry.reminder.profile')).tap();
        await element(by.id('action.reminder.add')).tap();
        await expect(element(by.id('screen.reminder'))).toBeVisible();
        await expect(element(by.id('input.reminder.title'))).toBeVisible();
        await expect(element(by.id('action.reminder.create'))).toBeVisible();
    });
});
