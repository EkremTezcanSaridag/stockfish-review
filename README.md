# 🎯 Stockfish Oyun Analizi

Chess.com tarzı **ücretsiz** satranç oyun analizi aracı. Stockfish WASM motoru kullanarak tarayıcınızda doğrudan oyunlarınızı analiz edin - abonelik gerekmez!

## ✨ Özellikler

- 🎮 **Tam Oyun Analizi**: Her hamleyi Stockfish ile değerlendirin
- 🏆 **Hamle Sınıflandırmaları**: Brilliant, Great, Best, Excellent, Good, Inaccuracy, Mistake, Blunder
- 📊 **Doğruluk Yüzdesi**: Beyaz ve Siyah için detaylı istatistikler
- 📈 **Değerlendirme Grafiği**: Oyun boyunca pozisyon avantajını görsel olarak takip edin
- ♟️ **İnteraktif Tahta**: Hamleleri ileri-geri alarak pozisyonları inceleyin
- 🌐 **Tamamen Ücretsiz**: Hiçbir API anahtarı veya abonelik gerektirmez
- 🚀 **Hızlı ve Modern**: Vite ile optimize edilmiş, responsive tasarım

## 🚀 Hızlı Başlangıç

### Canlı Siteyi Kullanın

Direkt olarak şu adresten kullanabilirsiniz:
```
https://ekremtezcansaridag.github.io/stockfish-review/
```

### Yerel Olarak Çalıştırma

**Build gerekmez!** Sadece dosyaları açın:

1. **Doğrudan tarayıcıda:**
   - `index.html` dosyasını çift tıklayarak açın
   - Veya Live Server gibi basit bir HTTP sunucusu kullanın

2. **Python ile (önerilir):**
   ```bash
   python -m http.server 8000
   ```
   Sonra http://localhost:8000 adresini açın

3. **Node.js ile:**
   ```bash
   npx serve .
   ```

### Geliştirme İçin (Opsiyonel)

Vite dev server kullanmak isterseniz:

```bash
npm install
npm run dev
```

## 📦 GitHub Pages'e Deploy Etme

Bu uygulama **statik dosyalar** olarak çalışır - build gerekmez!

### Deployment Adımları:

1. Repository ayarlarına gidin: **Settings → Pages**
2. **Source** olarak **"Deploy from a branch"** seçin
3. **Branch**: `main` seçin
4. **Folder**: `/ (root)` seçin
5. **Save** butonuna tıklayın

Hepsi bu! Siteniz birkaç saniye içinde yayında olacak:
```
https://KULLANICI_ADI.github.io/REPO_ADI/
```

### Neden Build Yok?

- Tüm bağımlılıklar CDN'den yüklenir (chess.js, chessboard.js)
- Modern JavaScript kullanılır ama ES6 modülleri yok
- Doğrudan tarayıcıda çalışır
- Vite/Webpack/Babel gerekmez

## 📖 Nasıl Kullanılır?

### PGN ile Analiz

1. **PGN Yapıştır** sekmesini seçin
2. Chess.com, Lichess veya herhangi bir kaynaktan PGN'yi kopyalayın
3. Metin alanına yapıştırın
4. **Analiz Et** butonuna tıklayın

**Örnek PGN:**
```
[Event "Casual Game"]
[Site "Chess.com"]
[White "player1"]
[Black "player2"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7
```

### Chess.com Oyunu ile Analiz

**Not:** Tarayıcı CORS kısıtlamaları nedeniyle, Chess.com URL'lerini doğrudan kullanmak yerine şu yöntemi öneririz:

1. Chess.com'da oyununuzu açın
2. **Share** butonuna tıklayın
3. **PGN** seçeneğini seçin
4. PGN'yi kopyalayın
5. Bu uygulamada **PGN Yapıştır** sekmesine yapıştırın

### Analiz Derinliği

- **12**: Hızlı analiz (~5-10 saniye/hamle)
- **15**: Önerilen - iyi denge (~10-15 saniye/hamle)
- **18**: Daha derin - daha doğru (~20-30 saniye/hamle)
- **20**: En iyi - en doğru ama yavaş (~30-45 saniye/hamle)

## 🎨 Sınıflandırmalar

| Sınıf | Açıklama | Centipawn Kaybı |
|-------|----------|-----------------|
| **Brilliant (!!)** | Muhteşem hamle - yaratıcı veya zor bulunan | En iyi hamle + özel kriter |
| **Great (!)** | Harika hamle | En iyi hamle |
| **Best** | En iyi hamle | 0-10 cp |
| **Excellent** | Mükemmel hamle | 10-25 cp |
| **Good** | İyi hamle | 25-50 cp |
| **Inaccuracy (?!)** | Belirsiz hamle | 50-100 cp |
| **Mistake (?)** | Hata | 100-300 cp |
| **Blunder (??)** | Büyük hata | 300+ cp |

## 🛠️ Teknolojiler

- **Vite**: Modern, hızlı build tool
- **chess.js**: PGN parsing ve satranç mantığı
- **Stockfish.js**: Tarayıcıda WASM ile çalışan güçlü satranç motoru
- **Chessboard.js**: Güzel ve kullanışlı satranç tahtası UI
- **Vanilla JavaScript**: Framework yükü olmadan hızlı ve hafif

## 🔧 Özelleştirme

### Tema Değiştirme

`style.css` dosyasındaki CSS değişkenlerini düzenleyerek renkleri özelleştirebilirsiniz:

```css
:root {
    --bg-dark: #1a1a1a;
    --accent: #81b64c;
    /* ... diğer renkler */
}
```

### Analiz Parametreleri

`main.js` dosyasında `classifyMove()` fonksiyonunu düzenleyerek sınıflandırma eşiklerini değiştirebilirsiniz.

## 📝 Lisans

Bu proje açık kaynaklıdır ve herkes tarafından özgürce kullanılabilir.

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Pull request göndermekten çekinmeyin.

## 🐛 Sorun Bildirme

Bir hata bulduysanız veya öneriniz varsa, lütfen GitHub Issues bölümünde bildirin.

## 📚 Kaynaklar

- [Stockfish Chess Engine](https://stockfishchess.org/)
- [chess.js Library](https://github.com/jhlywa/chess.js)
- [Chessboard.js](https://chessboardjs.com/)

---

**Not:** Bu uygulama tamamen tarayıcıda çalışır. Hiçbir veri sunucuya gönderilmez ve gizliliğiniz korunur.

Keyifli analizler! ♟️
