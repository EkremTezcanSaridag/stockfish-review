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

### Yerel Olarak Çalıştırma

1. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

2. **Geliştirme sunucusunu başlatın:**
   ```bash
   npm run dev
   ```

3. Tarayıcınızda `http://localhost:5173` adresini açın

### Derleme (Production)

```bash
npm run build
```

Bu komut `dist/` klasöründe production-ready dosyalar oluşturur.

## 📦 GitHub Pages'e Deploy Etme

### Yöntem 1: GitHub Actions (Otomatik)

1. Repository ayarlarına gidin: **Settings → Pages**
2. **Source** olarak **GitHub Actions** seçin
3. Aşağıdaki workflow dosyasını oluşturun: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

4. `main` branch'ine push yaptığınızda otomatik deploy olacaktır

### Yöntem 2: Manuel Deploy

```bash
npm run build
cd dist
git init
git add -A
git commit -m 'deploy'
git push -f git@github.com:KULLANICI_ADI/REPO_ADI.git main:gh-pages
```

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
