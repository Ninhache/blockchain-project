# Présentation — 0xAds

---

## Partie 1 — Contexte

### Sujet et objectif de l'application

**0xAds — Réseau publicitaire décentralisé**
Une marketplace où les publishers enregistrent leurs sites et créent des emplacements publicitaires, et où les annonceurs enchérissent pour y placer des publicités. Les revenus sont répartis automatiquement : 80% au publisher, 20% au protocole.

> **À dire** : L'objectif est de montrer qu'un intermédiaire classique (une régie pub comme Google Ads) peut être remplacé par un contrat autonome. Pas de compte à créer, pas d'approbation manuelle, tout est transparent et automatique.

---

### Les intérêts de la blockchain

Pourquoi la blockchain est-elle pertinente ici, et pas une simple base de données ?

| Problème classique | Solution apportée par la blockchain |
|--------------------|-------------------------------------|
| Confiance dans l'intermédiaire | Le contrat exécute les règles sans intervention humaine |
| Opacité des transactions | Chaque enchère, chaque paiement est visible on-chain |
| Risque de fraude / manipulation | Les fonds sont déposés et distribués par le contrat lui-même |
| Résistance à la censure | Aucun admin ne peut bloquer une enchère ou modifier les revenus |

> **À dire** : Quand un annonceur place une publicité, le contrat split immédiatement les fonds — 80% vont dans le solde du publisher, 20% dans celui du protocole. Personne n'a besoin de faire confiance à personne. C'est le cas d'usage typique où la blockchain apporte une vraie valeur par rapport à une appli web classique.

**Autres avantages concrets :**
- Immuabilité : l'historique des publicités est permanent et consultable
- Permissionless : n'importe qui peut participer sans s'inscrire
- Withdrawal pattern sécurisé : les fonds ne sont jamais bloqués (pattern `pull` anti-reentrancy)

---

### Architecture technique

**Stack utilisée :**
- **Smart contract** : Solidity 0.8.19
- **Blockchain locale** : Ganache (simulateur Ethereum, via Docker)
- **Frontend** : HTML / CSS / JavaScript vanilla + Web3.js
- **Wallet** : MetaMask (signature des transactions)
- **Infra** : Docker Compose (Ganache + Nginx), Makefile

**Schéma de l'architecture :**

```
[ Navigateur + MetaMask ]
        |
        | Web3.js (JSON-RPC)
        ↓
[ Ganache — nœud Ethereum local (port 8545) ]
        |
        ↓
[ OxAds.sol — Smart Contract déployé ]
```

**Déploiement :**
1. `docker compose up -d` → lance Ganache + Nginx
2. `node deploy.js` → compile OxAds.sol, déploie sur Ganache, patche automatiquement le frontend avec l'adresse du contrat
3. MetaMask configuré sur `localhost:8545` avec les comptes de test Ganache

> **À dire** : Le deploy.js automatise tout le pipeline : compilation, déploiement, injection de l'adresse dans le JS frontend. Ça permet de redéployer proprement à chaque fois sans manipulation manuelle.

---

## Partie 2 — Fonctionnalités

### Rôles

| Rôle | Capacités |
|------|-----------|
| **Publisher** | Enregistrer un site, créer des slots publicitaires (avec dimensions), retirer ses revenus |
| **Annonceur** | Enchérir sur un slot (image + lien), remplacer une pub existante en surenchérissant |
| **Owner du protocole** | Recevoir et retirer les 20% de commission automatique |

> **À dire** : Les rôles ne sont pas stockés en base de données — ils sont dérivés de qui a envoyé la transaction. `msg.sender == site.owner` dans le contrat remplace toute la couche d'authentification.

---

### Fonctionnalités du smart contract

**`registerSite(string name, string url)`**
- Crée un site publisher, retourne un `siteId` auto-incrémenté

**`addSlot(uint256 siteId, string name, uint256 width, uint256 height)`**
- Ajoute un emplacement pub à un site (vérification ownership)
- Prix initial : 0.01 ETH

**`placeAd(uint256 slotId, string imageUrl, string linkUrl) payable`**
- Vérifie `msg.value >= currentPrice`
- Split automatique : 80% publisher, 20% owner
- Augmente le prix du slot de 10%
- Archive la pub précédente dans l'historique

**`withdraw()`**
- Permet à publishers, annonceurs et owner de retirer leurs ETH accumulés
- Utilise `.call{value: amount}("")` — pattern pull sécurisé anti-reentrancy

**Vues disponibles :** `getSlotMeta()`, `getCurrentAd()`, `getHistory()`, `getPublisherSites()`

> **À dire** : Le contrat fait 227 lignes et gère l'intégralité de la logique métier — sans base de données, sans backend, sans API. Tout est lisible on-chain.

**Bonus — widget embarquable :**
```html
<div class="ox-ad-slot" data-slot-id="1"></div>
<script src="ox-ads.js"></script>
```
N'importe quel publisher peut intégrer ses slots sur son site avec deux lignes de HTML.

---

## Partie 3 — Démonstration

### Parcours de l'application

1. **Connexion MetaMask** → sélectionner un compte Ganache
2. **Publisher** : enregistrer un site → créer un slot (ex. 320×210)
3. **Annonceur** : placer une première publicité sur le slot (0.01 ETH)
4. **Annonceur 2** : surenchérir (0.011 ETH) → la première pub passe en historique
5. **Publisher** : retirer ses revenus (80% des enchères)
6. **Lecture du contrat** : montrer dans Ganache que les données sont bien on-chain

> **Points à souligner en démo** :
> - Chaque action = une transaction signée avec MetaMask
> - Les balances changent en temps réel dans le dashboard
> - L'historique des pubs est immuable et consultable
