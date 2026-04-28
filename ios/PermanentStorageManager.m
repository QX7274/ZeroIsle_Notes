//
//  PermanentStorageManager.m
//  ZeroIsle_Notes
//
//  Created by AI Assistant on 2024
//

#import "PermanentStorageManager.h"
#import <CommonCrypto/CommonDigest.h>

@interface PermanentStorageManager()

@property (nonatomic, strong) NSFileManager *fileManager;
@property (nonatomic, strong) NSString *storagePath;
@property (nonatomic, strong) NSString *backupPath;
@property (nonatomic, strong) NSOperationQueue *operationQueue;
@property (nonatomic, assign) NSInteger listenerCount;
@property (nonatomic, assign) BOOL hasListeners;

@end

@implementation PermanentStorageManager

RCT_EXPORT_MODULE();

- (instancetype)init {
    self = [super init];
    if (self) {
        _fileManager = [NSFileManager defaultManager];
        _operationQueue = [[NSOperationQueue alloc] init];
        _operationQueue.maxConcurrentOperationCount = 4;
        [self initializeDirectories];
    }
    return self;
}

- (void)initializeDirectories {
    // 获取应用文档目录
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    
    // 创建存储目录
    _storagePath = [documentsDirectory stringByAppendingPathComponent:@"permanent_storage"];
    if (![_fileManager fileExistsAtPath:_storagePath]) {
        [_fileManager createDirectoryAtPath:_storagePath withIntermediateDirectories:YES attributes:nil error:nil];
    }
    
    // 创建备份目录
    _backupPath = [documentsDirectory stringByAppendingPathComponent:@"backups"];
    if (![_fileManager fileExistsAtPath:_backupPath]) {
        [_fileManager createDirectoryAtPath:_backupPath withIntermediateDirectories:YES attributes:nil error:nil];
    }
    
    NSLog(@"存储目录初始化完成: %@", _storagePath);
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"StorageStatusChanged", @"BackupCompleted", @"RecoveryCompleted", @"StorageError"];
}

- (void)startObserving {
    self.hasListeners = YES;
    NSLog(@"[PermanentStorageManager][iOS] startObserving");
}

- (void)stopObserving {
    self.hasListeners = NO;
    NSLog(@"[PermanentStorageManager][iOS] stopObserving");
}

RCT_EXPORT_METHOD(addListener:(NSString *)eventName) {
    self.listenerCount += 1;
    NSLog(@"[PermanentStorageManager][iOS] addListener event=%@ count=%ld", eventName, (long)self.listenerCount);
}

RCT_EXPORT_METHOD(removeListeners:(double)count) {
    NSInteger removeCount = (NSInteger)count;
    NSInteger next = self.listenerCount - removeCount;
    self.listenerCount = next > 0 ? next : 0;
    NSLog(@"[PermanentStorageManager][iOS] removeListeners remove=%ld count=%ld", (long)removeCount, (long)self.listenerCount);
}

- (void)emitEventIfListening:(NSString *)eventName body:(NSDictionary *)body {
    if (!self.hasListeners || self.listenerCount <= 0) {
        return;
    }
    [self sendEventWithName:eventName body:body];
}

#pragma mark - React Native Methods

RCT_EXPORT_METHOD(initialize:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.operationQueue addOperationWithBlock:^{
        @try {
            NSLog(@"初始化永久存储模块");
            
            // 检查存储空间
            NSError *error;
            NSDictionary *attributes = [self.fileManager attributesOfFileSystemForPath:self.storagePath error:&error];
            NSNumber *freeSpace = [attributes objectForKey:NSFileSystemFreeSize];
            long long availableSpace = [freeSpace longLongValue];
            
            if (availableSpace < 100 * 1024 * 1024) { // 100MB
                NSLog(@"可用存储空间不足: %lld MB", availableSpace / 1024 / 1024);
            }
            
            // 清理旧备份
            [self cleanupOldBackups];
            
            NSDictionary *result = @{
                @"success": @YES,
                @"message": @"模块初始化成功",
                @"availableSpace": @(availableSpace)
            };
            
            resolve(result);
        } @catch (NSException *exception) {
            reject(@"INIT_ERROR", @"初始化失败", [NSError errorWithDomain:@"PermanentStorageManager" code:1 userInfo:@{NSLocalizedDescriptionKey: exception.reason}]);
        }
    }];
}

RCT_EXPORT_METHOD(createNote:(NSDictionary *)noteData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.operationQueue addOperationWithBlock:^{
        @try {
            NSString *title = noteData[@"title"] ?: @"未命名笔记";
            NSLog(@"创建笔记: %@", title);
            
            // 生成笔记ID
            NSString *noteId = [self generateNoteId];
            
            // 创建笔记数据
            NSMutableDictionary *noteDict = [noteData mutableCopy];
            noteDict[@"_id"] = noteId;
            noteDict[@"created_at"] = @([[NSDate date] timeIntervalSince1970] * 1000);
            noteDict[@"updated_at"] = @([[NSDate date] timeIntervalSince1970] * 1000);
            
            // 生成数据哈希
            NSString *dataHash = [self generateDataHash:[self dictionaryToJsonString:noteDict]];
            noteDict[@"dataHash"] = dataHash;
            
            // 保存到文件
            NSString *notePath = [self.storagePath stringByAppendingPathComponent:[NSString stringWithFormat:@"%@.json", noteId]];
            NSString *jsonString = [self dictionaryToJsonString:noteDict];
            [jsonString writeToFile:notePath atomically:YES encoding:NSUTF8StringEncoding error:nil];
            
            // 创建备份
            [self createBackup:noteId withData:noteDict];
            
            NSDictionary *result = @{
                @"_id": noteId,
                @"dataHash": dataHash,
                @"success": @YES
            };
            
            resolve(result);
            
            // 发送事件
            [self emitEventIfListening:@"StorageStatusChanged" body:@{
                @"status": @"note_created",
                @"noteId": noteId,
                @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
            }];
            
        } @catch (NSException *exception) {
            reject(@"CREATE_ERROR", @"创建笔记失败", [NSError errorWithDomain:@"PermanentStorageManager" code:2 userInfo:@{NSLocalizedDescriptionKey: exception.reason}]);
        }
    }];
}

RCT_EXPORT_METHOD(updateNote:(NSString *)noteId
                  updateData:(NSDictionary *)updateData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.operationQueue addOperationWithBlock:^{
        @try {
            NSLog(@"更新笔记: %@", noteId);
            
            NSString *notePath = [self.storagePath stringByAppendingPathComponent:[NSString stringWithFormat:@"%@.json", noteId]];
            if (![self.fileManager fileExistsAtPath:notePath]) {
                reject(@"NOT_FOUND", @"笔记不存在", [NSError errorWithDomain:@"PermanentStorageManager" code:404 userInfo:@{NSLocalizedDescriptionKey: @"笔记不存在"}]);
                return;
            }
            
            // 读取现有笔记
            NSString *jsonString = [NSString stringWithContentsOfFile:notePath encoding:NSUTF8StringEncoding error:nil];
            NSMutableDictionary *noteDict = [[self jsonStringToDictionary:jsonString] mutableCopy];
            
            // 更新数据
            [noteDict addEntriesFromDictionary:updateData];
            noteDict[@"updated_at"] = @([[NSDate date] timeIntervalSince1970] * 1000);
            
            // 重新生成数据哈希
            NSString *dataHash = [self generateDataHash:[self dictionaryToJsonString:noteDict]];
            noteDict[@"dataHash"] = dataHash;
            
            // 保存更新
            NSString *updatedJsonString = [self dictionaryToJsonString:noteDict];
            [updatedJsonString writeToFile:notePath atomically:YES encoding:NSUTF8StringEncoding error:nil];
            
            // 创建备份
            [self createBackup:noteId withData:noteDict];
            
            NSDictionary *result = @{
                @"_id": noteId,
                @"dataHash": dataHash,
                @"success": @YES
            };
            
            resolve(result);
            
            // 发送事件
            [self emitEventIfListening:@"StorageStatusChanged" body:@{
                @"status": @"note_updated",
                @"noteId": noteId,
                @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
            }];
            
        } @catch (NSException *exception) {
            reject(@"UPDATE_ERROR", @"更新笔记失败", [NSError errorWithDomain:@"PermanentStorageManager" code:3 userInfo:@{NSLocalizedDescriptionKey: exception.reason}]);
        }
    }];
}

RCT_EXPORT_METHOD(getNote:(NSString *)noteId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.operationQueue addOperationWithBlock:^{
        @try {
            NSLog(@"获取笔记: %@", noteId);
            
            NSString *notePath = [self.storagePath stringByAppendingPathComponent:[NSString stringWithFormat:@"%@.json", noteId]];
            if (![self.fileManager fileExistsAtPath:notePath]) {
                resolve([NSNull null]);
                return;
            }
            
            NSString *jsonString = [NSString stringWithContentsOfFile:notePath encoding:NSUTF8StringEncoding error:nil];
            NSDictionary *noteDict = [self jsonStringToDictionary:jsonString];
            
            resolve(noteDict);
            
        } @catch (NSException *exception) {
            reject(@"GET_ERROR", @"获取笔记失败", [NSError errorWithDomain:@"PermanentStorageManager" code:4 userInfo:@{NSLocalizedDescriptionKey: exception.reason}]);
        }
    }];
}

RCT_EXPORT_METHOD(performBackup:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.operationQueue addOperationWithBlock:^{
        @try {
            NSLog(@"开始执行备份");
            
            NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
            [formatter setDateFormat:@"yyyyMMdd_HHmmss"];
            NSString *timestamp = [formatter stringFromDate:[NSDate date]];
            
            NSString *backupFileName = [NSString stringWithFormat:@"backup_%@.zip", timestamp];
            NSString *backupPath = [self.backupPath stringByAppendingPathComponent:backupFileName];
            
            // 创建备份文件
            [self createFullBackup:backupPath];
            
            // 清理旧备份
            [self cleanupOldBackups];
            
            NSDictionary *attributes = [self.fileManager attributesOfItemAtPath:backupPath error:nil];
            NSNumber *fileSize = [attributes objectForKey:NSFileSize];
            
            NSDictionary *result = @{
                @"success": @YES,
                @"backupPath": backupPath,
                @"backupSize": fileSize ?: @0,
                @"timestamp": timestamp
            };
            
            resolve(result);
            
            // 发送事件
            [self emitEventIfListening:@"BackupCompleted" body:result];
            
        } @catch (NSException *exception) {
            reject(@"BACKUP_ERROR", @"备份失败", [NSError errorWithDomain:@"PermanentStorageManager" code:5 userInfo:@{NSLocalizedDescriptionKey: exception.reason}]);
        }
    }];
}

RCT_EXPORT_METHOD(performRecovery:(NSString *)backupId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.operationQueue addOperationWithBlock:^{
        @try {
            NSLog(@"开始执行恢复: %@", backupId);
            
            NSString *backupPath = [self.backupPath stringByAppendingPathComponent:backupId];
            if (![self.fileManager fileExistsAtPath:backupPath]) {
                reject(@"NOT_FOUND", @"备份文件不存在", [NSError errorWithDomain:@"PermanentStorageManager" code:404 userInfo:@{NSLocalizedDescriptionKey: @"备份文件不存在"}]);
                return;
            }
            
            // 恢复数据
            [self restoreFromBackup:backupPath];
            
            NSDictionary *result = @{
                @"success": @YES,
                @"message": @"恢复完成",
                @"backupId": backupId
            };
            
            resolve(result);
            
            // 发送事件
            [self emitEventIfListening:@"RecoveryCompleted" body:result];
            
        } @catch (NSException *exception) {
            reject(@"RECOVERY_ERROR", @"恢复失败", [NSError errorWithDomain:@"PermanentStorageManager" code:6 userInfo:@{NSLocalizedDescriptionKey: exception.reason}]);
        }
    }];
}

RCT_EXPORT_METHOD(getStorageStats:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.operationQueue addOperationWithBlock:^{
        @try {
            // 计算笔记数量
            NSArray *noteFiles = [self.fileManager contentsOfDirectoryAtPath:self.storagePath error:nil];
            NSPredicate *predicate = [NSPredicate predicateWithFormat:@"self ENDSWITH '.json'"];
            NSArray *filteredFiles = [noteFiles filteredArrayUsingPredicate:predicate];
            int noteCount = (int)[filteredFiles count];
            
            // 计算总大小
            long long totalSize = 0;
            for (NSString *fileName in filteredFiles) {
                NSString *filePath = [self.storagePath stringByAppendingPathComponent:fileName];
                NSDictionary *attributes = [self.fileManager attributesOfItemAtPath:filePath error:nil];
                NSNumber *fileSize = [attributes objectForKey:NSFileSize];
                totalSize += [fileSize longLongValue];
            }
            
            // 计算备份数量
            NSArray *backupFiles = [self.fileManager contentsOfDirectoryAtPath:self.backupPath error:nil];
            int backupCount = (int)[backupFiles count];
            
            // 计算可用空间
            NSDictionary *attributes = [self.fileManager attributesOfFileSystemForPath:self.storagePath error:nil];
            NSNumber *freeSpace = [attributes objectForKey:NSFileSystemFreeSize];
            long long availableSpace = [freeSpace longLongValue];
            
            NSDictionary *stats = @{
                @"noteCount": @(noteCount),
                @"totalSize": @(totalSize),
                @"backupCount": @(backupCount),
                @"availableSpace": @(availableSpace),
                @"storagePath": self.storagePath,
                @"backupPath": self.backupPath
            };
            
            resolve(stats);
            
        } @catch (NSException *exception) {
            reject(@"STATS_ERROR", @"获取存储统计失败", [NSError errorWithDomain:@"PermanentStorageManager" code:7 userInfo:@{NSLocalizedDescriptionKey: exception.reason}]);
        }
    }];
}

RCT_EXPORT_METHOD(checkStorageHealth:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.operationQueue addOperationWithBlock:^{
        @try {
            // 检查存储空间
            NSDictionary *attributes = [self.fileManager attributesOfFileSystemForPath:self.storagePath error:nil];
            NSNumber *freeSpace = [attributes objectForKey:NSFileSystemFreeSize];
            long long availableSpace = [freeSpace longLongValue];
            BOOL spaceOk = availableSpace > 100 * 1024 * 1024; // 100MB
            
            // 检查文件完整性
            int corruptedFiles = 0;
            NSArray *noteFiles = [self.fileManager contentsOfDirectoryAtPath:self.storagePath error:nil];
            NSPredicate *predicate = [NSPredicate predicateWithFormat:@"self ENDSWITH '.json'"];
            NSArray *filteredFiles = [noteFiles filteredArrayUsingPredicate:predicate];
            
            for (NSString *fileName in filteredFiles) {
                NSString *filePath = [self.storagePath stringByAppendingPathComponent:fileName];
                NSString *jsonString = [NSString stringWithContentsOfFile:filePath encoding:NSUTF8StringEncoding error:nil];
                NSDictionary *noteDict = [self jsonStringToDictionary:jsonString];
                
                NSString *storedHash = noteDict[@"dataHash"] ?: @"";
                NSString *calculatedHash = [self generateDataHash:jsonString];
                
                if (![storedHash isEqualToString:calculatedHash]) {
                    corruptedFiles++;
                }
            }
            
            NSDictionary *health = @{
                @"spaceOk": @(spaceOk),
                @"corruptedFiles": @(corruptedFiles),
                @"availableSpace": @(availableSpace),
                @"healthy": @(spaceOk && corruptedFiles == 0)
            };
            
            resolve(health);
            
        } @catch (NSException *exception) {
            reject(@"HEALTH_ERROR", @"检查存储健康状态失败", [NSError errorWithDomain:@"PermanentStorageManager" code:8 userInfo:@{NSLocalizedDescriptionKey: exception.reason}]);
        }
    }];
}

RCT_EXPORT_METHOD(optimizeStorage:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.operationQueue addOperationWithBlock:^{
        @try {
            NSLog(@"开始优化存储");
            
            // 清理临时文件
            [self cleanupTempFiles];
            
            // 压缩旧备份
            [self compressOldBackups];
            
            // 重建索引
            [self rebuildIndex];
            
            NSDictionary *result = @{
                @"success": @YES,
                @"message": @"存储优化完成"
            };
            
            resolve(result);
            
        } @catch (NSException *exception) {
            reject(@"OPTIMIZE_ERROR", @"优化存储失败", [NSError errorWithDomain:@"PermanentStorageManager" code:9 userInfo:@{NSLocalizedDescriptionKey: exception.reason}]);
        }
    }];
}

RCT_EXPORT_METHOD(clearCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.operationQueue addOperationWithBlock:^{
        @try {
            NSLog(@"开始清理缓存");
            
            // 清理临时文件
            [self cleanupTempFiles];
            
            // 清理旧日志
            [self cleanupOldLogs];
            
            NSDictionary *result = @{
                @"success": @YES,
                @"message": @"缓存清理完成"
            };
            
            resolve(result);
            
        } @catch (NSException *exception) {
            reject(@"CLEAR_ERROR", @"清理缓存失败", [NSError errorWithDomain:@"PermanentStorageManager" code:10 userInfo:@{NSLocalizedDescriptionKey: exception.reason}]);
        }
    }];
}

#pragma mark - Helper Methods

- (NSString *)generateNoteId {
    return [NSString stringWithFormat:@"note_%lld_%d", (long long)([[NSDate date] timeIntervalSince1970] * 1000), arc4random() % 1000];
}

- (NSString *)generateDataHash:(NSString *)data {
    const char *cStr = [data UTF8String];
    unsigned char digest[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(cStr, (CC_LONG)strlen(cStr), digest);
    
    NSMutableString *hash = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
    for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
        [hash appendFormat:@"%02x", digest[i]];
    }
    
    return [hash copy];
}

- (NSString *)dictionaryToJsonString:(NSDictionary *)dictionary {
    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:dictionary options:0 error:&error];
    if (error) {
        NSLog(@"JSON序列化失败: %@", error.localizedDescription);
        return @"{}";
    }
    return [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
}

- (NSDictionary *)jsonStringToDictionary:(NSString *)jsonString {
    NSError *error;
    NSData *jsonData = [jsonString dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *dictionary = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&error];
    if (error) {
        NSLog(@"JSON反序列化失败: %@", error.localizedDescription);
        return @{};
    }
    return dictionary;
}

- (void)createBackup:(NSString *)noteId withData:(NSDictionary *)data {
    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
    [formatter setDateFormat:@"yyyyMMdd_HHmmss"];
    NSString *timestamp = [formatter stringFromDate:[NSDate date]];
    
    NSString *backupFileName = [NSString stringWithFormat:@"%@_%@.json", noteId, timestamp];
    NSString *backupPath = [self.backupPath stringByAppendingPathComponent:backupFileName];
    
    NSString *jsonString = [self dictionaryToJsonString:data];
    [jsonString writeToFile:backupPath atomically:YES encoding:NSUTF8StringEncoding error:nil];
}

- (void)createFullBackup:(NSString *)backupPath {
    // 这里需要实现完整的备份逻辑
    // 包括压缩和加密
    NSLog(@"创建完整备份: %@", backupPath);
}

- (void)restoreFromBackup:(NSString *)backupPath {
    // 这里需要实现从备份恢复的逻辑
    NSLog(@"从备份恢复: %@", backupPath);
}

- (void)cleanupOldBackups {
    NSArray *backupFiles = [self.fileManager contentsOfDirectoryAtPath:self.backupPath error:nil];
    if ([backupFiles count] > 10) {
        // 保留最新的10个备份
        // 这里需要实现清理逻辑
        NSLog(@"清理旧备份");
    }
}

- (void)cleanupTempFiles {
    // 清理临时文件
    NSLog(@"清理临时文件");
}

- (void)compressOldBackups {
    // 压缩旧备份
    NSLog(@"压缩旧备份");
}

- (void)rebuildIndex {
    // 重建索引
    NSLog(@"重建索引");
}

- (void)cleanupOldLogs {
    // 清理旧日志
    NSLog(@"清理旧日志");
}

@end




