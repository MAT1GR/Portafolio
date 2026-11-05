import type { Store } from "@prisma/client";
import { fill } from "./i18n";

/**
 * Textos legales por defecto de cada tienda (términos, privacidad, reembolsos).
 * Se generan con los datos legales cargados y se pueden reemplazar por texto propio en Contenido.
 */

type Section = [title: string, body: string];
type LegalSet = { terms: Section[]; privacy: Section[]; refunds: Section[] };

const T: Record<string, LegalSet> = {
  es: {
    terms: [
      ["Quién vende", "Esta tienda es operada por {seller}{taxId}{address}. Contacto: {email}."],
      ["Productos", "Vendemos productos digitales (por ejemplo ebooks, cursos, plantillas o archivos descargables). No se envía nada físico."],
      ["Precios y pago", "Los precios se muestran en el checkout en la moneda indicada. Tu banco puede aplicar cargos o percepciones por pagos en otra moneda. El pago lo procesa la pasarela elegida (Mercado Pago, Stripe, PayPal, Whop o transferencia)."],
      ["Licencia de uso", "La compra te da una licencia personal e intransferible. No está permitido revender, compartir ni publicar el contenido."],
      ["Entrega", "Después de confirmado el pago recibís un email con el acceso. Si no te llega en 24 horas, escribinos a {email}."],
      ["Cambios", "Podemos actualizar estos términos. La versión vigente es la publicada en esta página."],
    ],
    privacy: [
      ["Datos que recolectamos", "Email, nombre y teléfono (si los cargás), país, datos técnicos de navegación y origen de la visita (UTM). Los datos de tarjeta los procesa la pasarela de pago; no los guardamos."],
      ["Para qué los usamos", "Para entregarte el producto, darte soporte, enviarte avisos sobre tu compra o un pedido sin terminar y medir el rendimiento de nuestros anuncios."],
      ["Con quién los compartimos", "Con la pasarela de pago, el proveedor de email y herramientas de medición publicitaria (por ejemplo Meta), solo para esos fines."],
      ["Tus derechos", "Podés pedir acceso, corrección o eliminación de tus datos escribiendo a {email}."],
    ],
    refunds: [
      ["Entrega", "Los productos son digitales y se entregan de inmediato por email después del pago, con enlaces de descarga o acceso al área de miembros."],
      ["Garantía", "Tenés {days} días desde la compra para pedir el reembolso si el producto no es lo que esperabas. Escribinos a {email} con tu número de pedido."],
      ["Cómo se reembolsa", "El reembolso se hace al mismo medio de pago, normalmente en 5 a 10 días hábiles según tu banco. Al reembolsar se desactivan los accesos."],
      ["Cancelación", "Como el acceso es inmediato, una vez vencida la garantía no hay reembolsos. Antes de iniciar un contracargo con tu banco, contactanos: lo resolvemos más rápido."],
    ],
  },
  en: {
    terms: [
      ["Seller", "This store is operated by {seller}{taxId}{address}. Contact: {email}."],
      ["Products", "We sell digital products (such as ebooks, courses, templates or downloadable files). Nothing is shipped physically."],
      ["Prices and payment", "Prices are shown at checkout in the stated currency. Your bank may add fees for payments in another currency. Payments are processed by the selected provider (Mercado Pago, Stripe, PayPal, Whop or bank transfer)."],
      ["License", "Your purchase grants a personal, non-transferable license. Reselling, sharing or publishing the content is not allowed."],
      ["Delivery", "Once the payment is confirmed you receive an email with your access. If it doesn't arrive within 24 hours, write to {email}."],
      ["Changes", "We may update these terms. The current version is the one published on this page."],
    ],
    privacy: [
      ["Data we collect", "Email, name and phone (if provided), country, technical browsing data and visit source (UTM). Card data is processed by the payment provider; we don't store it."],
      ["How we use it", "To deliver your product, provide support, send notices about your purchase or an unfinished order, and measure our advertising."],
      ["Who we share it with", "The payment provider, the email provider and advertising measurement tools (such as Meta), only for those purposes."],
      ["Your rights", "You can request access, correction or deletion of your data by writing to {email}."],
    ],
    refunds: [
      ["Delivery", "Products are digital and delivered immediately by email after payment, with download links or access to the members area."],
      ["Guarantee", "You have {days} days from purchase to request a refund if the product is not what you expected. Email {email} with your order number."],
      ["How refunds work", "Refunds go back to the original payment method, usually within 5 to 10 business days depending on your bank. Access is disabled after a refund."],
      ["Cancellation", "Since access is immediate, no refunds are issued after the guarantee period. Please contact us before opening a dispute with your bank: it's faster."],
    ],
  },
  pt: {
    terms: [
      ["Quem vende", "Esta loja é operada por {seller}{taxId}{address}. Contato: {email}."],
      ["Produtos", "Vendemos produtos digitais (como ebooks, cursos, modelos ou arquivos para download). Nada é enviado fisicamente."],
      ["Preços e pagamento", "Os preços aparecem no checkout na moeda indicada. Seu banco pode cobrar taxas em pagamentos em outra moeda. O pagamento é processado pelo meio escolhido."],
      ["Licença de uso", "A compra concede uma licença pessoal e intransferível. Não é permitido revender, compartilhar ou publicar o conteúdo."],
      ["Entrega", "Após a confirmação do pagamento você recebe um e-mail com o acesso. Se não chegar em 24 horas, escreva para {email}."],
      ["Alterações", "Podemos atualizar estes termos. A versão vigente é a publicada nesta página."],
    ],
    privacy: [
      ["Dados coletados", "E-mail, nome e telefone (se informados), país, dados técnicos de navegação e origem da visita (UTM). Os dados do cartão são processados pelo meio de pagamento; não os guardamos."],
      ["Uso dos dados", "Para entregar o produto, dar suporte, enviar avisos sobre sua compra ou um pedido não concluído e medir nossos anúncios."],
      ["Compartilhamento", "Com o meio de pagamento, o provedor de e-mail e ferramentas de medição de anúncios (como a Meta), apenas para esses fins."],
      ["Seus direitos", "Você pode pedir acesso, correção ou exclusão dos seus dados escrevendo para {email}."],
    ],
    refunds: [
      ["Entrega", "Os produtos são digitais e entregues imediatamente por e-mail após o pagamento."],
      ["Garantia", "Você tem {days} dias a partir da compra para pedir reembolso. Escreva para {email} com o número do pedido."],
      ["Como é feito", "O reembolso volta ao mesmo meio de pagamento, normalmente em 5 a 10 dias úteis. Os acessos são desativados após o reembolso."],
      ["Cancelamento", "Como o acesso é imediato, não há reembolsos após o prazo de garantia. Fale conosco antes de abrir uma contestação no banco."],
    ],
  },
  it: {
    terms: [
      ["Venditore", "Questo negozio è gestito da {seller}{taxId}{address}. Contatto: {email}."],
      ["Prodotti", "Vendiamo prodotti digitali (ebook, corsi, modelli o file scaricabili). Non viene spedito nulla di fisico."],
      ["Prezzi e pagamento", "I prezzi sono indicati al checkout nella valuta mostrata. La tua banca può applicare commissioni per pagamenti in altra valuta. Il pagamento è gestito dal metodo scelto."],
      ["Licenza", "L'acquisto concede una licenza personale e non trasferibile. È vietato rivendere, condividere o pubblicare il contenuto."],
      ["Consegna", "Dopo la conferma del pagamento ricevi un'email con l'accesso. Se non arriva entro 24 ore, scrivi a {email}."],
      ["Modifiche", "Possiamo aggiornare questi termini. Vale la versione pubblicata in questa pagina."],
    ],
    privacy: [
      ["Dati raccolti", "Email, nome e telefono (se forniti), paese, dati tecnici di navigazione e origine della visita (UTM). I dati della carta sono gestiti dal fornitore di pagamento; non li conserviamo."],
      ["Finalità", "Consegnare il prodotto, offrire assistenza, inviare avvisi sull'acquisto o su un ordine non completato e misurare la nostra pubblicità."],
      ["Condivisione", "Con il fornitore di pagamento, il fornitore email e gli strumenti di misurazione pubblicitaria (come Meta), solo per questi scopi."],
      ["I tuoi diritti", "Puoi chiedere accesso, rettifica o cancellazione dei tuoi dati scrivendo a {email}."],
    ],
    refunds: [
      ["Consegna", "I prodotti sono digitali e vengono consegnati subito via email dopo il pagamento. Acquistando accetti l'esecuzione immediata del contratto."],
      ["Garanzia", "Hai {days} giorni dall'acquisto per chiedere il rimborso. Scrivi a {email} con il numero d'ordine."],
      ["Rimborso", "Il rimborso torna sullo stesso metodo di pagamento, di solito entro 5-10 giorni lavorativi. Dopo il rimborso l'accesso viene disattivato."],
      ["Annullamento", "Dato che l'accesso è immediato, dopo il periodo di garanzia non sono previsti rimborsi. Contattaci prima di aprire una contestazione con la banca."],
    ],
  },
  fr: {
    terms: [
      ["Vendeur", "Cette boutique est exploitée par {seller}{taxId}{address}. Contact : {email}."],
      ["Produits", "Nous vendons des produits numériques (ebooks, formations, modèles ou fichiers téléchargeables). Rien n'est expédié physiquement."],
      ["Prix et paiement", "Les prix sont affichés au paiement dans la devise indiquée. Votre banque peut appliquer des frais pour un paiement en devise étrangère. Le paiement est traité par le moyen choisi."],
      ["Licence", "L'achat donne droit à une licence personnelle et non transférable. Il est interdit de revendre, partager ou publier le contenu."],
      ["Livraison", "Après confirmation du paiement, vous recevez un e-mail avec votre accès. S'il n'arrive pas sous 24 heures, écrivez à {email}."],
      ["Modifications", "Nous pouvons modifier ces conditions. La version en vigueur est celle publiée sur cette page."],
    ],
    privacy: [
      ["Données collectées", "E-mail, nom et téléphone (si fournis), pays, données techniques de navigation et source de la visite (UTM). Les données de carte sont traitées par le prestataire de paiement ; nous ne les conservons pas."],
      ["Utilisation", "Livrer le produit, assurer le support, envoyer des avis sur votre achat ou une commande inachevée et mesurer nos publicités."],
      ["Partage", "Avec le prestataire de paiement, le service d'e-mail et les outils de mesure publicitaire (comme Meta), uniquement à ces fins."],
      ["Vos droits", "Vous pouvez demander l'accès, la rectification ou la suppression de vos données en écrivant à {email}."],
    ],
    refunds: [
      ["Livraison", "Les produits sont numériques et livrés immédiatement par e-mail après paiement. En achetant, vous acceptez l'exécution immédiate du contrat."],
      ["Garantie", "Vous disposez de {days} jours après l'achat pour demander un remboursement. Écrivez à {email} avec votre numéro de commande."],
      ["Remboursement", "Le remboursement est effectué sur le moyen de paiement d'origine, généralement sous 5 à 10 jours ouvrés. L'accès est désactivé après remboursement."],
      ["Annulation", "L'accès étant immédiat, aucun remboursement n'est accordé après la période de garantie. Contactez-nous avant d'ouvrir un litige bancaire."],
    ],
  },
  de: {
    terms: [
      ["Anbieter", "Dieser Shop wird betrieben von {seller}{taxId}{address}. Kontakt: {email}."],
      ["Produkte", "Wir verkaufen digitale Produkte (z. B. E-Books, Kurse, Vorlagen oder Dateien zum Herunterladen). Es wird nichts physisch versendet."],
      ["Preise und Zahlung", "Die Preise werden im Checkout in der angegebenen Währung angezeigt. Deine Bank kann bei Zahlungen in Fremdwährung Gebühren erheben. Die Zahlung wird vom gewählten Anbieter abgewickelt."],
      ["Nutzungslizenz", "Mit dem Kauf erhältst du eine persönliche, nicht übertragbare Lizenz. Weiterverkauf, Weitergabe oder Veröffentlichung der Inhalte sind nicht erlaubt."],
      ["Lieferung", "Nach Zahlungsbestätigung erhältst du eine E-Mail mit deinem Zugang. Falls sie nicht innerhalb von 24 Stunden ankommt, schreib an {email}."],
      ["Änderungen", "Wir können diese Bedingungen anpassen. Es gilt die auf dieser Seite veröffentlichte Fassung."],
    ],
    privacy: [
      ["Erhobene Daten", "E-Mail, Name und Telefonnummer (falls angegeben), Land, technische Nutzungsdaten und Herkunft des Besuchs (UTM). Kartendaten verarbeitet der Zahlungsanbieter; wir speichern sie nicht."],
      ["Zweck", "Lieferung des Produkts, Support, Hinweise zu deinem Kauf oder einer unvollständigen Bestellung sowie Messung unserer Werbung."],
      ["Weitergabe", "An den Zahlungsanbieter, den E-Mail-Dienst und Werbemessungstools (z. B. Meta), ausschließlich zu diesen Zwecken."],
      ["Deine Rechte", "Du kannst Auskunft, Berichtigung oder Löschung deiner Daten per E-Mail an {email} verlangen."],
    ],
    refunds: [
      ["Lieferung", "Die Produkte sind digital und werden nach der Zahlung sofort per E-Mail bereitgestellt. Mit dem Kauf stimmst du der sofortigen Ausführung zu und erkennst an, dass dein Widerrufsrecht damit erlischt."],
      ["Garantie", "Unabhängig davon hast du {days} Tage ab Kauf, um eine Rückerstattung zu verlangen. Schreib an {email} mit deiner Bestellnummer."],
      ["Erstattung", "Die Erstattung erfolgt auf das ursprüngliche Zahlungsmittel, meist innerhalb von 5 bis 10 Werktagen. Danach wird der Zugang deaktiviert."],
      ["Stornierung", "Da der Zugang sofort erfolgt, gibt es nach Ablauf der Garantie keine Erstattungen. Bitte kontaktiere uns vor einer Rückbuchung bei deiner Bank."],
    ],
  },
  ro: {
    terms: [
      ["Vânzătorul", "Acest magazin este operat de {seller}{taxId}{address}. Contact: {email}."],
      ["Produse", "Vindem produse digitale (ebookuri, cursuri, șabloane sau fișiere descărcabile). Nu se livrează nimic fizic."],
      ["Prețuri și plată", "Prețurile sunt afișate la plată în moneda indicată. Banca ta poate percepe comisioane pentru plăți în altă monedă. Plata este procesată de metoda aleasă."],
      ["Licență", "Cumpărarea îți oferă o licență personală și netransferabilă. Nu este permisă revânzarea, distribuirea sau publicarea conținutului."],
      ["Livrare", "După confirmarea plății primești un email cu accesul. Dacă nu ajunge în 24 de ore, scrie-ne la {email}."],
      ["Modificări", "Putem actualiza acești termeni. Este valabilă versiunea publicată pe această pagină."],
    ],
    privacy: [
      ["Date colectate", "Email, nume și telefon (dacă le completezi), țara, date tehnice de navigare și sursa vizitei (UTM). Datele cardului sunt procesate de procesatorul de plăți; nu le stocăm."],
      ["Scopul", "Livrarea produsului, asistență, notificări despre comandă sau o comandă nefinalizată și măsurarea reclamelor noastre."],
      ["Cui le transmitem", "Procesatorului de plăți, furnizorului de email și instrumentelor de măsurare a reclamelor (de ex. Meta), doar în aceste scopuri."],
      ["Drepturile tale", "Poți cere acces, rectificare sau ștergerea datelor scriind la {email}."],
    ],
    refunds: [
      ["Livrare", "Produsele sunt digitale și se livrează imediat pe email după plată. Prin cumpărare accepți executarea imediată a contractului."],
      ["Garanție", "Ai {days} zile de la cumpărare pentru a cere rambursarea. Scrie la {email} cu numărul comenzii."],
      ["Rambursarea", "Banii se returnează pe aceeași metodă de plată, de obicei în 5–10 zile lucrătoare. După rambursare accesul se dezactivează."],
      ["Anulare", "Deoarece accesul este imediat, după perioada de garanție nu se fac rambursări. Contactează-ne înainte de a deschide o dispută la bancă."],
    ],
  },
  cs: {
    terms: [
      ["Prodávající", "Tento obchod provozuje {seller}{taxId}{address}. Kontakt: {email}."],
      ["Produkty", "Prodáváme digitální produkty (e-knihy, kurzy, šablony nebo soubory ke stažení). Nic se fyzicky nezasílá."],
      ["Ceny a platba", "Ceny jsou uvedeny v pokladně ve zobrazené měně. Vaše banka může účtovat poplatky za platby v cizí měně. Platbu zpracovává zvolený poskytovatel."],
      ["Licence", "Nákupem získáváte osobní a nepřenosnou licenci. Obsah není dovoleno přeprodávat, sdílet ani zveřejňovat."],
      ["Doručení", "Po potvrzení platby obdržíte e-mail s přístupem. Pokud nedorazí do 24 hodin, napište na {email}."],
      ["Změny", "Tyto podmínky můžeme upravit. Platí verze zveřejněná na této stránce."],
    ],
    privacy: [
      ["Shromažďované údaje", "E-mail, jméno a telefon (pokud je uvedete), země, technické údaje o návštěvě a její zdroj (UTM). Údaje o kartě zpracovává platební brána; neukládáme je."],
      ["Účel", "Doručení produktu, podpora, upozornění k nákupu nebo nedokončené objednávce a měření naší reklamy."],
      ["Předávání", "Platební bráně, poskytovateli e-mailu a nástrojům pro měření reklamy (např. Meta), pouze k těmto účelům."],
      ["Vaše práva", "O přístup, opravu nebo výmaz údajů můžete požádat na {email}."],
    ],
    refunds: [
      ["Doručení", "Produkty jsou digitální a po zaplacení se doručují ihned e-mailem. Nákupem souhlasíte s okamžitým plněním smlouvy."],
      ["Záruka", "Na žádost o vrácení peněz máte {days} dní od nákupu. Napište na {email} s číslem objednávky."],
      ["Vrácení peněz", "Peníze vracíme na původní platební metodu, obvykle do 5–10 pracovních dnů. Po vrácení se přístup deaktivuje."],
      ["Zrušení", "Protože je přístup okamžitý, po uplynutí záruky se peníze nevracejí. Před reklamací u banky nás prosím kontaktujte."],
    ],
  },
  hu: {
    terms: [
      ["Eladó", "Az üzletet a(z) {seller}{taxId}{address} üzemelteti. Kapcsolat: {email}."],
      ["Termékek", "Digitális termékeket árusítunk (e-könyvek, tanfolyamok, sablonok vagy letölthető fájlok). Fizikai szállítás nincs."],
      ["Árak és fizetés", "Az árak a fizetési oldalon a feltüntetett pénznemben szerepelnek. Más pénznemben történő fizetésnél a bank díjat számíthat fel. A fizetést a választott szolgáltató kezeli."],
      ["Licenc", "A vásárlással személyes, át nem ruházható licencet kapsz. A tartalom továbbértékesítése, megosztása vagy közzététele tilos."],
      ["Kézbesítés", "A fizetés megerősítése után e-mailben kapod meg a hozzáférést. Ha 24 órán belül nem érkezik meg, írj a(z) {email} címre."],
      ["Változások", "A feltételeket módosíthatjuk. Az ezen az oldalon közzétett változat érvényes."],
    ],
    privacy: [
      ["Gyűjtött adatok", "E-mail, név és telefonszám (ha megadod), ország, technikai böngészési adatok és a látogatás forrása (UTM). A kártyaadatokat a fizetési szolgáltató kezeli; mi nem tároljuk."],
      ["Cél", "A termék kézbesítése, ügyfélszolgálat, értesítések a vásárlásról vagy befejezetlen rendelésről, valamint hirdetéseink mérése."],
      ["Átadás", "A fizetési szolgáltatónak, az e-mail-szolgáltatónak és hirdetésmérő eszközöknek (pl. Meta), kizárólag e célokra."],
      ["Jogaid", "Adataidhoz való hozzáférést, helyesbítést vagy törlést a(z) {email} címen kérhetsz."],
    ],
    refunds: [
      ["Kézbesítés", "A termékek digitálisak, a fizetés után azonnal e-mailben érkeznek. A vásárlással elfogadod a szerződés azonnali teljesítését."],
      ["Garancia", "A vásárlástól számított {days} napon belül kérhetsz visszatérítést. Írj a(z) {email} címre a rendelésszámmal."],
      ["Visszatérítés", "A visszatérítés az eredeti fizetési módra történik, általában 5–10 munkanapon belül. Ezután a hozzáférés megszűnik."],
      ["Lemondás", "Mivel a hozzáférés azonnali, a garanciális időszak után nincs visszatérítés. Banki reklamáció előtt kérjük, keress minket."],
    ],
  },
  pl: {
    terms: [
      ["Sprzedawca", "Sklep prowadzi {seller}{taxId}{address}. Kontakt: {email}."],
      ["Produkty", "Sprzedajemy produkty cyfrowe (e-booki, kursy, szablony lub pliki do pobrania). Nic nie jest wysyłane fizycznie."],
      ["Ceny i płatność", "Ceny są podane w kasie w wskazanej walucie. Bank może naliczyć opłaty za płatność w innej walucie. Płatność obsługuje wybrany operator."],
      ["Licencja", "Zakup daje osobistą, niezbywalną licencję. Odsprzedaż, udostępnianie lub publikowanie treści jest zabronione."],
      ["Dostawa", "Po potwierdzeniu płatności otrzymasz e-mail z dostępem. Jeśli nie dotrze w ciągu 24 godzin, napisz na {email}."],
      ["Zmiany", "Możemy aktualizować regulamin. Obowiązuje wersja opublikowana na tej stronie."],
    ],
    privacy: [
      ["Zbierane dane", "E-mail, imię i telefon (jeśli je podasz), kraj, dane techniczne wizyty i jej źródło (UTM). Dane karty przetwarza operator płatności; nie przechowujemy ich."],
      ["Cel", "Dostarczenie produktu, obsługa klienta, powiadomienia o zakupie lub niedokończonym zamówieniu oraz pomiar naszych reklam."],
      ["Udostępnianie", "Operatorowi płatności, dostawcy poczty e-mail i narzędziom do pomiaru reklam (np. Meta), wyłącznie w tych celach."],
      ["Twoje prawa", "Możesz poprosić o dostęp, poprawienie lub usunięcie danych, pisząc na {email}."],
    ],
    refunds: [
      ["Dostawa", "Produkty są cyfrowe i dostarczane natychmiast e-mailem po płatności. Kupując, zgadzasz się na natychmiastowe wykonanie umowy."],
      ["Gwarancja", "Masz {days} dni od zakupu na prośbę o zwrot. Napisz na {email}, podając numer zamówienia."],
      ["Zwrot", "Zwrot trafia na pierwotną metodę płatności, zwykle w ciągu 5–10 dni roboczych. Po zwrocie dostęp zostaje wyłączony."],
      ["Anulowanie", "Ponieważ dostęp jest natychmiastowy, po okresie gwarancji zwroty nie przysługują. Przed złożeniem reklamacji w banku skontaktuj się z nami."],
    ],
  },
};

export type LegalKind = "terms" | "privacy" | "refunds";

export function legalSections(store: Store, kind: LegalKind): Section[] {
  const set = T[store.language] ?? T.en;
  const params = {
    seller: store.legalName || store.name,
    taxId: store.legalTaxId ? ` (${store.legalTaxId})` : "",
    address: store.legalAddress ? `, ${store.legalAddress}` : "",
    email: store.supportEmail || store.legalName || store.name,
    days: store.guaranteeDays,
  };
  return set[kind].map(([title, body]) => [title, fill(body, params)]);
}

export function customLegalText(store: Store, kind: LegalKind) {
  const text = kind === "terms" ? store.termsText : kind === "privacy" ? store.privacyText : store.refundText;
  return text && text.trim() ? text : null;
}
