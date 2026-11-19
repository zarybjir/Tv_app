plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Webová část je stejná jako v televizi: zkopíruje se z kořene repozitáře do assets.
val webDir = layout.buildDirectory.dir("generated/web")
val copyWeb by tasks.registering(Copy::class) {
    from(rootProject.projectDir) {
        include("index.html", "icon.png", "version.json", "css/**", "js/**")
    }
    into(webDir.map { it.dir("web") })
}

android {
    namespace = "cz.videoteka.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "cz.videoteka.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 2
        versionName = "1.1"
    }

    sourceSets["main"].assets.srcDir(webDir)

    // Podepisování release buildu: hodnoty z proměnných prostředí (GitHub Actions).
    // Když chybí, vznikne debug APK.
    fun prop(name: String): String? = System.getenv(name) ?: (project.findProperty(name) as String?)
    val ksPath = prop("VIDEOTEKA_KEYSTORE")
    if (ksPath != null) {
        signingConfigs {
            create("release") {
                storeFile = file(ksPath)
                storePassword = prop("VIDEOTEKA_KEYSTORE_PASSWORD")
                keyAlias = prop("VIDEOTEKA_KEY_ALIAS")
                keyPassword = prop("VIDEOTEKA_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (ksPath != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
