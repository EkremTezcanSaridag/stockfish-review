# 📖 Kullanım Kılavuzu / User Guide

## İçindekiler

1. [Hızlı Başlangıç](#hızlı-başlangıç)
2. [Oyun Yükleme Yöntemleri](#oyun-yükleme-yöntemleri)
3. [Analiz Seçenekleri](#analiz-seçenekleri)
4. [Sonuçları Anlama](#sonuçları-anlama)
5. [Sık Sorulan Sorular](#sık-sorulan-sorular)

---

## Hızlı Başlangıç

### 1. Uygulamayı Açın

Tarayıcınızda uygulamayı açtığınızda, Stockfish motoru otomatik olarak yüklenecektir. "Hazır!" mesajını gördükten sonra analize başlayabilirsiniz.

### 2. PGN Hazırlayın

Şu yöntemlerden biriyle PGN'nizi alın:

#### Chess.com'dan:
1. Oyununuzu Chess.com'da açın
2. Sağ üstteki **"Share"** (Paylaş) butonuna tıklayın
3. **"PGN"** seçeneğine tıklayın
4. Açılan metni kopyalayın (Ctrl+A, Ctrl+C)

#### Lichess'ten:
1. Oyununuzu Lichess'te açın
2. Hamburger menüye (☰) tıklayın
3. **"Study"** → **"Export"** → **"PGN"**
4. PGN'yi kopyalayın

#### Diğer Kaynaklardan:
Herhangi bir standart PGN formatındaki oyun çalışacaktır.

### 3. Analiz Edin

1. **"PGN Yapıştır"** sekmesini seçin
2. PGN'yi metin alanına yapıştırın (Ctrl+V)
3. İsterseniz analiz derinliğini ayarlayın (varsayılan: 15)
4. **"Analiz Et"** butonuna tıklayın
5. Bekleyin... (her hamle ~10-15 saniye sürer)

---

## Oyun Yükleme Yöntemleri

### Yöntem 1: PGN Yapıştır (Önerilen ✓)

En güvenilir yöntem. Herhangi bir kaynaktan kopyalanan PGN çalışır.

**Minimum PGN örneği:**
```
1. e4 e5 2. Nf3 Nc6 3. Bb5
```

**Tam PGN örneği:**
```
[Event "Casual Game"]
[Site "Chess.com"]
[Date "2024.01.15"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6
```

### Yöntem 2: Chess.com URL

**Not:** Tarayıcı güvenlik kısıtlamaları nedeniyle doğrudan URL yükleme her zaman çalışmayabilir.

**Çalışmazsa:**
1. Oyunu Chess.com'da açın
2. Share → PGN ile kopyalayın
3. Yöntem 1'i kullanın

---

## Analiz Seçenekleri

### Analiz Derinliği

Analiz kalitesini ve süresini belirler:

| Derinlik | Hız | Kalite | Kullanım |
|----------|-----|--------|----------|
| **12** | Çok Hızlı | İyi | Hızlı ön izleme |
| **15** | Orta | Çok İyi | **Önerilen** 🌟 |
| **18** | Yavaş | Mükemmel | Ciddi analiz |
| **20** | Çok Yavaş | En İyi | Turnuva oyunları |

**Öneri:** Çoğu oyun için derinlik 15 yeterlidir. Sadece kritik pozisyonlar için 18-20 kullanın.

### Analizi İptal Etme

Uzun analiz sırasında **"İptal"** butonuna tıklayarak durdurabilirsiniz.

---

## Sonuçları Anlama

### Doğruluk Yüzdesi

**%100** = Mükemmel, her hamle en iyisi
**%95-99** = Çok iyi oyun
**%90-94** = İyi oyun
**%80-89** = Orta seviye oyun
**%70-79** = Hatalı oyun
**%70 altı** = Çok hatalı oyun

**Not:** Profesyonel oyuncular bile nadiren %100'e ulaşır!

### Hamle Sınıflandırmaları

#### 🟦 Brilliant (Muhteşem)
- En zor bulunacak hamle
- Genellikle bir fedakarlık veya sürpriz hamle
- Oyunun kazanılmasında kritik rol oynar

**Örnek:** Vezir fedası sonrası mat kombinasyonu

#### 🟩 Best (En İyi)
- Pozisyondaki objektif en iyi hamle
- Stockfish'in de önereceği hamle
- Centipawn kaybı 0-10 arası

#### 🟨 Excellent (Mükemmel)
- Çok iyi hamle, neredeyse en iyi kadar
- Centipawn kaybı 10-25 arası
- Pratikte fark edilmez

#### 🟡 Good (İyi)
- Sağlam hamle, oyunu sürdürür
- Centipawn kaybı 25-50 arası
- Küçük avantajdan vazgeçme

#### 🟠 Inaccuracy (Belirsizlik)
- Doğru olmayan ama ciddi olmayan hata
- Centipawn kaybı 50-100 arası
- Pozisyonu eşitler veya hafif dezavantaj

**Ne yapmalı?** Bu tür hamleleri analiz edin ve neden daha iyi alternatifler olduğunu anlayın.

#### 🔴 Mistake (Hata)
- Net hata, avantaj kaybı
- Centipawn kaybı 100-300 arası
- Pozisyon önemli ölçüde kötüleşir

**Ne yapmalı?** En iyi hamleyi inceleyin ve neden önemli olduğunu öğrenin.

#### ⚫ Blunder (Bozgun)
- Ciddi hata, oyunu kaybettirebilir
- Centipawn kaybı 300+ arası
- Genellikle mat veya ciddi materyal kaybı

**Ne yapmalı?** Bu hamleyi iyice analiz edin. Neden bu kadar kötü? Neyi kaçırdınız?

### Centipawn Nedir?

**Centipawn (cp)** = Piyon değerinin 1/100'ü

- **100 cp** = 1 piyon avantajı
- **300 cp** = 3 piyon avantajı (yaklaşık bir hafif taş)
- **500 cp** = 5 piyon avantajı (yaklaşık bir kale)

**Pozitif değer** = Beyaz önde
**Negatif değer** = Siyah önde

### Değerlendirme Çubuğu

Üstteki beyaz çubuk oyunun durumunu gösterir:

- **Çubuk sağa doğru** → Beyaz avantajlı
- **Çubuk sola doğru** → Siyah avantajlı
- **Ortada** → Eşit pozisyon

### En İyi Hamle Önerileri

Hatalı hamleler için, uygulama size en iyi alternatifi gösterir:

```
Kayıp: 245 centipawn
En iyi hamle: Nf6
```

Bu bilgiyi kullanarak neden sizin hamleniz kötüydü ve alternatif ne yapardu öğrenebilirsiniz.

---

## Sık Sorulan Sorular

### Analiz çok yavaş, hızlandırabilir miyim?

**Evet:**
1. Analiz derinliğini 12'ye düşürün
2. Daha güçlü bir cihaz kullanın
3. Tarayıcıda diğer sekmeleri kapatın

### Chess.com URL neden çalışmıyor?

CORS (Cross-Origin) güvenlik kısıtlamaları nedeniyle bazı tarayıcılar API erişimini engelliyor.

**Çözüm:** Chess.com'dan Share → PGN ile manuel kopyalayın.

### Hangi PGN formatları destekleniyor?

- ✅ Standard PGN (tüm header'lar ile)
- ✅ Minimal PGN (sadece hamleler)
- ✅ Chess.com PGN
- ✅ Lichess PGN
- ✅ FICS, ICC, ICCF formatları

### Analizim doğru mu?

**Evet!** Stockfish dünyanın en güçlü satranç motorudur (Elo ~3500+). Derinlik 15'te bile profesyonel seviyede analiz yapar.

### Neden bazı hamleler "Brilliant" olmuyor?

Brilliant sınıflandırması çok seçicidir. Bir hamlenin brilliant olması için:
- En iyi hamle olmalı
- Çok zor bulunabilir olmalı (genellikle materyal fedası)
- Oyunun gidişatını değiştirmeli

Çoğu oyunda hiç brilliant hamle olmayabilir - bu normaldir!

### Offline çalışır mı?

**Hayır.** Stockfish.js motoru CDN'den yüklenir, bu nedenle internet bağlantısı gerekir.

### Telefonumda çalışır mı?

**Evet!** Responsive tasarım sayesinde mobil cihazlarda da çalışır. Ancak analiz biraz daha yavaş olabilir.

### Analizimi kaydedebilir miyim?

Şu anda otomatik kaydetme yok. Ancak:
- Tahtayı ve hamleleri ekran görüntüsü ile kaydedin
- Tarayıcı sekmesini açık bırakın
- Gelecek versiyonlarda export özelliği eklenebilir

### Birden fazla oyunu aynı anda analiz edebilir miyim?

Her seferinde bir oyun. Yeni analiz başlatmak önceki sonuçları siler.

**Çözüm:** Her oyun için yeni bir tarayıcı sekmesi açın.

### Stockfish başlamıyor, ne yapmalıyım?

1. Sayfayı yenileyin (F5)
2. Tarayıcı önbelleğini temizleyin
3. Farklı bir tarayıcı deneyin (Chrome önerilir)
4. İnternet bağlantınızı kontrol edin

### En iyi hamle gösterilenle farklı, neden?

Stockfish farklı pozisyonlarda farklı hamleler önerebilir. Ayrıca:
- Analiz derinliği etkiler
- Bazı pozisyonlarda birden fazla "en iyi" hamle vardır
- Materyal eşitse stil tercihi olabilir

---

## 💡 İpuçları

### Oyununuzu Geliştirme

1. **Blunder'ları önce çalışın** - En büyük hatalarınızı bulun
2. **Açılışlarınızı öğrenin** - İlk 10 hamleye dikkat edin
3. **Orta oyun planlarını inceleyin** - Hangi hamlelerde kayıp yaşıyorsunuz?
4. **Bitişleri tekrar edin** - Final hataları oyunu kaybettirir

### Etkili Analiz

- Her hatanın neden hata olduğunu anlayın
- En iyi hamleyi sadece not etmeyin, mantığını öğrenin
- Benzer pozisyonlardaki kalıpları tanıyın
- Kendi oyunlarınızı düzenli olarak analiz edin

### Zamandan Tasarruf

- Sadece kritik pozisyonları derinlemesine analiz edin
- Açık basit pozisyonlar için düşük derinlik yeterli
- Uzun oyunlar için sabırlı olun veya parça parça analiz edin

---

**Başarılar! İyi analizler!** ♟️🎯

Sorularınız için: GitHub Issues bölümünden bize ulaşabilirsiniz.
