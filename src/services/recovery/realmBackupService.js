import RNFS from 'react-native-fs';

export async function backupRealmFile(realmPath) {
  try {
    const backupDir = `${RNFS.DocumentDirectoryPath}/realm_backups`;
    const exists = await RNFS.exists(backupDir);
    if (!exists) {
      await RNFS.mkdir(backupDir);
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = `${backupDir}/backup_${ts}.realm`;
    if (await RNFS.exists(realmPath)) {
      await RNFS.copyFile(realmPath, dest);
      return { success: true, path: dest };
    }

    throw new Error('Realm file does not exist');
  } catch (e) {
    throw e;
  }
}

