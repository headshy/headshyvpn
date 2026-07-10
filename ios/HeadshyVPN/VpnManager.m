#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VpnManager, NSObject)
RCT_EXTERN_METHOD(startVPN:(NSString *)config resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopVPN:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
@end