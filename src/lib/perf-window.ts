/**
 * Performans puanının kaç savaşa bakacağı.
 *
 * Parti kurarken sorulan soru "bu adam genel olarak iyi mi" değil, "şu an
 * formda mı" — üç ay önceki sayılar bugünkü kadroyu kurmaya yaramıyor.
 * Bu yüzden puan, rapor girilmiş son N savaştan hesaplanıyor.
 *
 * Pencere herkes için aynı savaşlardan oluşuyor (kişi başı "son N katıldığı
 * savaş" değil): öyle olsaydı seyrek gelen birinin penceresi aylar öncesine
 * uzanır ve sık gelenle kıyaslanamaz hâle gelirdi.
 *
 * API (`/api/performances/user-averages`) ve puanı gösteren arayüz aynı
 * sayıyı kullansın diye burada duruyor.
 */
export const RECENT_WAR_WINDOW = 5;
