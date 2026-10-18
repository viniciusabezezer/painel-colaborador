/* Câmera (ler os cartões) e microfone (gravar áudio das perguntas) nos
   projetos nativos gerados pelo Capacitor. Idempotente: pode rodar sempre. */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const AQUI = resolve(import.meta.dirname);

const manifesto = join(AQUI, 'android/app/src/main/AndroidManifest.xml');
if (existsSync(manifesto)) {
    let x = await readFile(manifesto, 'utf8');
    const precisa = [
        '<uses-permission android:name="android.permission.CAMERA" />',
        '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
        '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
        '<uses-feature android:name="android.hardware.camera" android:required="false" />'
    ].filter((linha) => !x.includes(linha));
    if (precisa.length) {
        x = x.replace('</manifest>', '    ' + precisa.join('\n    ') + '\n</manifest>');
        await writeFile(manifesto, x);
    }
    console.log('Android: permissões de câmera e microfone ok');
}

const plist = join(AQUI, 'ios/App/App/Info.plist');
if (existsSync(plist)) {
    let x = await readFile(plist, 'utf8');
    const chaves = {
        NSCameraUsageDescription: 'A câmera lê os cartões dos alunos durante a aula.',
        NSMicrophoneUsageDescription: 'O microfone grava o áudio das perguntas, quando você quiser.'
    };
    for (const [chave, texto] of Object.entries(chaves)) {
        if (!x.includes(`<key>${chave}</key>`)) x = x.replace(/<dict>/, `<dict>\n\t<key>${chave}</key>\n\t<string>${texto}</string>`);
    }
    await writeFile(plist, x);
    console.log('iOS: textos de permissão ok');
}
