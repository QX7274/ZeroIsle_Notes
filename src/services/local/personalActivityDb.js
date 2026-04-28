import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const ACTIVITIES_KEY = 'personal_activities';
const DRAFTS_KEY = 'personal_activity_drafts';
const RECYCLE_BIN_KEY = 'personal_activity_recycle_bin';

class PersonalActivityDB {
  // Helper to get all data from a key
  async _getData(key) {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error(`Failed to fetch data for key ${key}:`, e);
      return [];
    }
  }

  // Helper to set all data for a key
  async _setData(key, data) {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
      console.error(`Failed to save data for key ${key}:`, e);
    }
  }

  // --- Activities --- //

  async getActivities() {
    const activities = await this._getData(ACTIVITIES_KEY);
    // Return activities that are not marked as deleted, sorted by most recent
    return activities
      .filter(act => act.status !== 'deleted')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async getActivity(id) {
    const activities = await this.getActivities();
    return activities.find(act => act._id === id);
  }

  async saveActivity(activityData) {
    const activities = await this._getData(ACTIVITIES_KEY);
    const now = new Date().toISOString();

    if (activityData._id) { // Update existing activity
      const index = activities.findIndex(act => act._id === activityData._id);
      if (index !== -1) {
        activities[index] = { ...activities[index], ...activityData, updated_at: now };
      } else {
        // If not found, treat as new, though this shouldn't happen with proper ID management
        activities.push({ ...activityData, created_at: now, updated_at: now });
      }
    } else { // Create new activity
      const newActivity = {
        _id: uuidv4(),
        ...activityData,
        created_at: now,
        updated_at: now,
        status: 'published',
      };
      activities.push(newActivity);
    }

    await this._setData(ACTIVITIES_KEY, activities);
    return this.getActivities(); // Return the updated list
  }

  async deleteActivity(id) {
    const activities = await this._getData(ACTIVITIES_KEY);
    const activityIndex = activities.findIndex(act => act._id === id);

    if (activityIndex !== -1) {
      const activityToMove = { ...activities[activityIndex], status: 'deleted', deleted_at: new Date().toISOString() };

      // Remove from main list
      activities.splice(activityIndex, 1);
      await this._setData(ACTIVITIES_KEY, activities);

      // Add to recycle bin
      const recycleBin = await this._getData(RECYCLE_BIN_KEY);
      recycleBin.push(activityToMove);
      await this._setData(RECYCLE_BIN_KEY, recycleBin);
    }
    return this.getActivities();
  }

  // --- Drafts --- //

  async getDrafts() {
    return this._getData(DRAFTS_KEY);
  }

  async saveDraft(draftData) {
    const drafts = await this._getData(DRAFTS_KEY);
    const now = new Date().toISOString();

    if (draftData._id) { // Update existing draft
      const index = drafts.findIndex(d => d._id === draftData._id);
      if (index !== -1) {
        drafts[index] = { ...drafts[index], ...draftData, updated_at: now };
      }
    } else { // Create new draft
      const newDraft = { _id: uuidv4(), ...draftData, created_at: now, updated_at: now };
      drafts.push(newDraft);
    }
    await this._setData(DRAFTS_KEY, drafts);
    return newDraft._id ? newDraft : drafts.find(d => d.created_at === now);
  }

  async deleteDraft(id) {
    let drafts = await this._getData(DRAFTS_KEY);
    drafts = drafts.filter(d => d._id !== id);
    await this._setData(DRAFTS_KEY, drafts);
    return drafts;
  }

  // --- Recycle Bin --- //

  async getRecycledItems() {
    return this._getData(RECYCLE_BIN_KEY);
  }

  async restoreItem(id) {
    const recycleBin = await this._getData(RECYCLE_BIN_KEY);
    const itemIndex = recycleBin.findIndex(item => item._id === id);

    if (itemIndex !== -1) {
      const itemToRestore = { ...recycleBin[itemIndex], status: 'published' };
      delete itemToRestore.deleted_at;

      // Remove from recycle bin
      recycleBin.splice(itemIndex, 1);
      await this._setData(RECYCLE_BIN_KEY, recycleBin);

      // Add back to activities list
      const activities = await this._getData(ACTIVITIES_KEY);
      activities.push(itemToRestore);
      await this._setData(ACTIVITIES_KEY, activities);
    }
    return this.getRecycledItems();
  }

  async permanentlyDeleteItem(id) {
    let recycleBin = await this._getData(RECYCLE_BIN_KEY);
    recycleBin = recycleBin.filter(item => item._id !== id);
    await this._setData(RECYCLE_BIN_KEY, recycleBin);
    return recycleBin;
  }
}

export default new PersonalActivityDB();
