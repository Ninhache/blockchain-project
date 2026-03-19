// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.8.20;

contract OxAds {

    uint256 public constant BASE_PRICE       = 0.01 ether;
    uint256 public constant PRICE_MULTIPLIER = 110; // +10% à chaque enchère
    uint256 public constant PUBLISHER_SHARE  = 80;  // 80% publisher, 20% protocole

    // stocké dans le bytecode, pas dans le storage
    address public immutable protocolOwner;

    struct Ad {
        address advertiser;
        string  imageUrl;   // URL non vérifiée par le contrat
        string  linkUrl;
        uint256 price;      // en wei
        uint256 timestamp;
    }

    struct Slot {
        uint256 id;
        uint256 siteId;
        address publisher;  // dupliqué depuis Site pour éviter un SLOAD dans placeAd
        string  name;
        uint256 width;
        uint256 height;
        uint256 currentPrice;
        Ad      currentAd;  // adresse zéro = slot vide
        Ad[]    history;
    }

    struct Site {
        uint256   id;
        string    name;
        string    url;
        address   publisher;
        uint256[] slotIds;
    }

    // les IDs commencent à 1, 0 = non initialisé
    uint256 private _siteCounter;
    uint256 private _slotCounter;

    mapping(uint256 => Site)      private  _sites;
    mapping(uint256 => Slot)      private  _slots;
    mapping(address => uint256[]) public   publisherSites;
    mapping(address => uint256)   public   pendingWithdrawals; // pattern pull, évite la reentrancy

    // tableaux plats pour l'itération côté frontend (les mappings ne sont pas itérables)
    uint256[] public siteIds;
    uint256[] public slotIds;

    event SiteRegistered(
        uint256 indexed siteId,
        address indexed publisher,
        string  name,
        string  url
    );
    event SlotCreated(
        uint256 indexed slotId,
        uint256 indexed siteId,
        address indexed publisher,
        string  name,
        uint256 width,
        uint256 height
    );
    event AdPlaced(
        uint256 indexed slotId,
        uint256 indexed siteId,
        address indexed advertiser,
        uint256 price,
        string  imageUrl,
        string  linkUrl
    );

    constructor() {
        protocolOwner = msg.sender;
    }

    function registerSite(
        string calldata name,
        string calldata url
    ) external returns (uint256 siteId) {
        _siteCounter++;
        siteId = _siteCounter;

        _sites[siteId].id        = siteId;
        _sites[siteId].name      = name;
        _sites[siteId].url       = url;
        _sites[siteId].publisher = msg.sender;

        publisherSites[msg.sender].push(siteId);
        siteIds.push(siteId);

        emit SiteRegistered(siteId, msg.sender, name, url);
    }

    function addSlot(
        uint256         siteId,
        string calldata name,
        uint256         width,
        uint256         height
    ) external returns (uint256 slotId) {
        require(siteId > 0 && siteId <= _siteCounter, "Unknown site");
        require(_sites[siteId].publisher == msg.sender, "Not site owner");

        _slotCounter++;
        slotId = _slotCounter;

        _slots[slotId].id           = slotId;
        _slots[slotId].siteId       = siteId;
        _slots[slotId].publisher    = msg.sender;
        _slots[slotId].name         = name;
        _slots[slotId].width        = width;
        _slots[slotId].height       = height;
        _slots[slotId].currentPrice = BASE_PRICE;

        _sites[siteId].slotIds.push(slotId);
        slotIds.push(slotId);

        emit SlotCreated(slotId, siteId, msg.sender, name, width, height);
    }

    function placeAd(
        uint256         slotId,
        string calldata imageUrl,
        string calldata linkUrl
    ) external payable {
        require(slotId > 0 && slotId <= _slotCounter, "Unknown slot");

        Slot storage slot = _slots[slotId];
        require(msg.value >= slot.currentPrice, "Bid too low"); // >= : le surplus n'est pas remboursé

        // division entière : le dust va au protocolOwner via la soustraction
        uint256 publisherCut = msg.value * PUBLISHER_SHARE / 100;
        pendingWithdrawals[slot.publisher] += publisherCut;
        pendingWithdrawals[protocolOwner]  += msg.value - publisherCut;

        if (slot.currentAd.advertiser != address(0)) {
            slot.history.push(slot.currentAd);
        }

        slot.currentAd = Ad({
            advertiser: msg.sender,
            imageUrl:   imageUrl,
            linkUrl:    linkUrl,
            price:      msg.value,
            timestamp:  block.timestamp
        });

        slot.currentPrice = slot.currentPrice * PRICE_MULTIPLIER / 100;

        emit AdPlaced(slotId, slot.siteId, msg.sender, msg.value, imageUrl, linkUrl);
    }

    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingWithdrawals[msg.sender] = 0; // zéro avant le transfert, anti-reentrancy
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function getSiteMeta(uint256 siteId) external view returns (
        string  memory name,
        string  memory url,
        address publisher,
        uint256 slotCount,
        bool    exists
    ) {
        Site storage s = _sites[siteId];
        return (s.name, s.url, s.publisher, s.slotIds.length, siteId > 0 && siteId <= _siteCounter);
    }

    function getSiteSlotIds(uint256 siteId) external view returns (uint256[] memory) {
        return _sites[siteId].slotIds;
    }

    function getSlotMeta(uint256 slotId) external view returns (
        string  memory name,
        uint256 siteId,
        uint256 width,
        uint256 height,
        uint256 currentPrice,
        bool    exists
    ) {
        Slot storage s = _slots[slotId];
        return (s.name, s.siteId, s.width, s.height, s.currentPrice, slotId > 0 && slotId <= _slotCounter);
    }

    function getCurrentAd(uint256 slotId) external view returns (
        address advertiser,
        string  memory imageUrl,
        string  memory linkUrl,
        uint256 price,
        uint256 timestamp
    ) {
        Ad storage a = _slots[slotId].currentAd;
        return (a.advertiser, a.imageUrl, a.linkUrl, a.price, a.timestamp);
    }

    function getHistory(uint256 slotId) external view returns (Ad[] memory) {
        return _slots[slotId].history;
    }

    function getSiteIds() external view returns (uint256[] memory) {
        return siteIds;
    }

    function getSiteCount() external view returns (uint256) {
        return _siteCounter;
    }

    function getSlotIds() external view returns (uint256[] memory) {
        return slotIds;
    }

    function getSlotCount() external view returns (uint256) {
        return _slotCounter;
    }

    function getPublisherSites(address publisher) external view returns (uint256[] memory) {
        return publisherSites[publisher];
    }
}
