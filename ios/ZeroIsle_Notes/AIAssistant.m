#import "AIAssistant.h"
#import <React/RCTLog.h>

@interface AIAssistant ()
@property (nonatomic, assign) NSInteger listenerCount;
@property (nonatomic, assign) BOOL hasListeners;
@end

@implementation AIAssistant

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onAiStreamChunk"];
}

- (void)startObserving {
  self.hasListeners = YES;
  RCTLogInfo(@"[AIAssistant][iOS] startObserving");
}

- (void)stopObserving {
  self.hasListeners = NO;
  RCTLogInfo(@"[AIAssistant][iOS] stopObserving");
}

RCT_EXPORT_METHOD(addListener:(NSString *)eventName) {
  self.listenerCount += 1;
  RCTLogInfo(@"[AIAssistant][iOS] addListener event=%@ count=%ld", eventName, (long)self.listenerCount);
}

RCT_EXPORT_METHOD(removeListeners:(double)count) {
  NSInteger removeCount = (NSInteger)count;
  NSInteger next = self.listenerCount - removeCount;
  self.listenerCount = next > 0 ? next : 0;
  RCTLogInfo(@"[AIAssistant][iOS] removeListeners remove=%ld count=%ld", (long)removeCount, (long)self.listenerCount);
}

RCT_EXPORT_METHOD(sendStreamingMessage:(NSString *)message
                  engine:(NSString *)engine
                  model:(NSString *)model
                  options:(NSDictionary *)options) {
  NSString *prompt = options[@"prompt"] ?: @"";
  NSString *full = [NSString stringWithFormat:@"iOS simulated stream: %@ | %@ | %@ | %@", message ?: @"", engine ?: @"", model ?: @"", prompt];
  NSArray<NSString *> *chunks = [full componentsSeparatedByString:@" "];

  [chunks enumerateObjectsUsingBlock:^(NSString * _Nonnull obj, NSUInteger idx, BOOL * _Nonnull stop) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(idx * 0.08 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      if (!self.hasListeners || self.listenerCount <= 0) {
        return;
      }

      BOOL isFinal = idx == chunks.count - 1;
      [self sendEventWithName:@"onAiStreamChunk" body:@{
        @"chunk": [obj stringByAppendingString:@" "],
        @"isFinal": @(isFinal)
      }];
    });
  }];
}

@end
