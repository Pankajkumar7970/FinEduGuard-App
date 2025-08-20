package com.pankaj465.FinGuard

import android.app.Application
import android.content.res.Configuration
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.shell.MainReactPackage
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

// Security Provider
import com.google.android.gms.common.GooglePlayServicesNotAvailableException
import com.google.android.gms.common.GooglePlayServicesRepairableException
import com.google.android.gms.security.ProviderInstaller

// Custom Modules
import com.pankaj465.FinGuard.DeveloperSettingsModule
import com.pankaj465.FinGuard.RootDetectionModule

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
    this,
    object : DefaultReactNativeHost(this) {
      override fun getPackages(): MutableList<ReactPackage> {
        // Default packages from React Native
        val packages = PackageList(this).packages.toMutableList()

        // Add custom inline package for DeveloperSettings & RootDetection
        packages.add(object : ReactPackage {
          override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
            return listOf(
              DeveloperSettingsModule(reactContext),
              RootDetectionModule(reactContext)
            )
          }

          override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
            return emptyList()
          }
        })

        return packages
      }

      override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"
      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
      override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()

    // 🔹 Update security provider
    try {
      ProviderInstaller.installIfNeeded(applicationContext)
      Log.d("MainApplication", "Security provider updated successfully")
    } catch (e: GooglePlayServicesRepairableException) {
      Log.w("MainApplication", "Play Services can prompt user to update security provider")
    } catch (e: GooglePlayServicesNotAvailableException) {
      Log.w("MainApplication", "Device without Play Services, using built-in provider")
    } catch (t: Throwable) {
      Log.e("MainApplication", "Failed to update security provider", t)
    }

    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
