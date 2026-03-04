// --- gestion chemins GitHub Pages ---
export const BASE_URL = window.location.origin + "/" + window.location.pathname.split("/")[1] + "/";

export function url(file) {
  return BASE_URL + String(file).replace(/^\.\//, "").replace(/^\/+/, "");
}

// rendre accessible aux scripts non-modules
window.url = url;



proj4.defs(
  "EPSG:2154",
  "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
);

// On définit les variables pour pouvoir les utiliser dans les fichiers fonctions
window.map = L.map("map", { zoomControl: false, doubleClickZoom: false })
  .setView([46.603354, 1.888334], 7);

// Dans un module, alias local
const map = window.map;

// Couches Leaflet
window.pollutionLayer = L.layerGroup().addTo(map);
window.icpeLayer      = L.layerGroup().addTo(map);
window.stepLayer      = L.layerGroup().addTo(map);
window.ceLayer        = L.layerGroup().addTo(map);
window.stationsXYPrecisLayer = L.layerGroup().addTo(map);
window.stationsXYCentroLayer = L.layerGroup().addTo(map);

// Couches rejets (GeoJSON locaux à la racine)
window.rejetsStepCollectivitesLayer = L.layerGroup().addTo(map);
window.rejetsSteuIndustriesLayer    = L.layerGroup().addTo(map);

// Etat
var jsonData = null;
window.bbox = [];

// Icônes
var greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Charger les données GeoJSON depuis le serveur
window.geojsonLayer = undefined;

fetchJson(window.url("bvtopo4326_8cvl.geojson"))
  .then((response) => response.json())
  .then((data) => {
    // Créer une couche GeoJSON sans l'ajouter à la carte
    window.geojsonLayer = L.geoJSON(data);
  })
  .catch((error) =>
    console.error("Erreur lors du chargement du fichier GeoJSON :", error)
  );



window.lastGeoJSON4326 = null;
var lastPollueurspoints = null;
var lastStepspoints = null;
var currentPolygon = null;
//window.currentBBox = null;
var markerbv = null;
import { sendPostRequest } from './postRequest.js';


//On définit les fonctions globales
window.convertGeoJSON=function(geojson, fromProj, toProj) {
    var newGeoJSON = JSON.parse(JSON.stringify(geojson));
    newGeoJSON.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates = feature.geometry.coordinates.map(polygon => {
                return polygon.map(ring => {
                    return ring.map(coord => {
                        var convertedCoord = proj4(fromProj, toProj, coord);
                        return [convertedCoord[0], convertedCoord[1]];
                    });
                });
            });
        }
    });
    return newGeoJSON;
}
function calculateBBoxFromGeoJSON(feature) {
    const coords = feature.geometry.coordinates[0]; // Utilisation des coordonnées du premier anneau du polygone
    let minX = coords[0][0], maxX = coords[0][0];
    let minY = coords[0][1], maxY = coords[0][1];

    for (const coord of coords) {
        const [x, y] = coord;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    return [minX, minY, maxX, maxY];
}




function initializeMap() {
 ///////////////////
            if (typeof Gp === 'undefined') {
                console.error("Gp is not defined. Ensure the Geoportal script is loaded.");
                return;
            }
    Gp.Services.getConfig({
        apiKey: "essentiels",
        onSuccess: function(config) {
            console.log("Configuration retrieved successfully:", config);

            if (!map) {
                console.error("Map is not defined. Ensure the map is initialized before calling 'go()'.");
                return;
            }
            
            go();
        },
        onError: function(error) {
            console.error("Failed to retrieve configuration:", error);
        }
    });
            function go() {
                enableGeolocation(map);
                var myRenderer = L.canvas({ padding: 0.5 });

// Gestion du chargement du fichier GeoJSON quand on clique file-input

                var lyrOrtho = L.geoportalLayer.WMTS({
                    layer: "ORTHOIMAGERY.ORTHOPHOTOS"
                });

                var lyrMaps = L.geoportalLayer.WMTS({
                    layer: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2"
                }, {
                    opacity: 0.7
                }).addTo(map);

                var lyrOSM = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                });

                var baseLayers = {
                    "OpenStreetMap": lyrOSM,
                    "Orthophotos": lyrOrtho,
                    "Plan IGN": lyrMaps
                };

                L.control.layers(baseLayers).addTo(map);
            //}
///////////////
           

               



////////////////////////////////////////////////////////////////////////

//                                                                                                //         MAP ON CLICK  //

////////
let clickTimeout = null;
const doubleClickDelay = 300; // Délai pour différencier le clic simple du double clic


map.on('click', function(e) { 

    if (clickTimeout !== null) {
        // C'est un double clic
        clearTimeout(clickTimeout); // Annuler le timer du clic simple
        clickTimeout = null;

    window.latlng = e.latlng;

    var coords = [latlng.lng, latlng.lat];
    const point = turf.point([latlng.lng, latlng.lat]);

    // Dimensions de la BBOX (largeur de 1 degré en X, hauteur de 0.5 degré en Y)
    const widthX = 0.5;
    const heightY = 0.25;

    // Calcul des coordonnées de la BBOX
    const minX = latlng.lng - (widthX / 2);
    const maxX = latlng.lng + (widthX / 2);
    const minY = latlng.lat - (heightY / 2);
    const maxY = latlng.lat + (heightY / 2);

    // Création de la BBOX
    const bbox = [minX, minY, maxX, maxY];

//    console.log("in click", bbox);

    // Construction de l'URL avec la BBOX calculée
    window.urlbb4 = `https://services.sandre.eaufrance.fr/geo/sandre?language=fre&SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=sa:BassinVersantTopographique_FXX_Topage2024&SRSNAME=urn:ogc:def:crs:EPSG::4326&BBOX=${bbox.join(',')},urn:ogc:def:crs:EPSG:`;

    console.log("urlbb4", urlbb4);

    // Fetch des données
    fetch(urlbb4)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.statusText);
        }
        return response.text();
    })
    .then(data => {
        console.log('GML Response:', data);
    
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data, "application/xml");

        const polygons = xmlDoc.getElementsByTagName('gml:Polygon');
        console.log('Polygones extraits:', polygons.length);
    
        const geojsonFeatures = [];
    
        for (let i = 0; i < polygons.length; i++) {
            const exteriorElement = polygons[i].getElementsByTagNameNS('*', 'exterior')[0]; 
            if (!exteriorElement) continue;

            const linearRingElement = exteriorElement.getElementsByTagNameNS('*', 'LinearRing')[0];
            if (!linearRingElement) continue;

            const posListElement = linearRingElement.getElementsByTagNameNS('*', 'posList')[0];
            if (!posListElement) continue;

            const linearRings = posListElement.textContent.trim().split(' ');
    
            const coords = [];
            for (let j = 0; j < linearRings.length; j += 2) {
                const lon = parseFloat(linearRings[j + 1]); // Longitude
                const lat = parseFloat(linearRings[j]); // Latitude
                if (!isNaN(lon) && !isNaN(lat)) {
                    coords.push([lon, lat]);
                }
            }
    
            if (coords.length > 0) {
                geojsonFeatures.push({
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [coords]
                    },
                    properties: {}
                });
            }
        }
    
        const geojsonObject = {
            type: "FeatureCollection",
            features: geojsonFeatures
        };
    
        console.log('GeoJSON avant utilisation:', JSON.stringify(geojsonObject, null, 2));

        if (geojsonObject.features.length > 0) {

            L.geoJSON(geojsonObject, {
                style: {
                    color: 'blue',
                    fillColor: 'blue',
                    fillOpacity: 0.1,
                    weight: 0.5 }


                }
        
        
        
        ).addTo(map);
        }
    
        // Début recherche polygone
        window.intersectedPolygon = null;
        const point = turf.point([latlng.lng, latlng.lat]);  // Utilisation correcte des coordonnées
    
        for (const feature of geojsonObject.features) {
            const coordinates = feature.geometry.coordinates;
    
            if (feature.geometry.type === 'Polygon') {
                const polygon = turf.polygon(coordinates);
                if (turf.booleanPointInPolygon(point, polygon)) {
                    window.intersectedPolygon = feature;
                    break;
                }
            }
        }
    
        if (window.intersectedPolygon) {
            L.geoJSON(window.intersectedPolygon, {
                style: {
                    color: 'yellow',
                    fillColor: 'yellow',
                    fillOpacity: 0.5,
                    weight: 2
                }
            }).addTo(map);
    
            window.bbox = calculateBBoxFromGeoJSON(window.intersectedPolygon);
            console.log("Calculated BBOX:", window.bbox);

			if (typeof window.refreshRejetsIfChecked === "function") {
  window.refreshRejetsIfChecked();
}

if (typeof window.refreshStationsIfChecked === "function") {
  window.refreshStationsIfChecked();
}

            // Rafraîchit les couches dépendantes du BV si elles sont cochées (défini dans event.js)
            if (typeof window.refreshBvLayers === "function") {
                try { window.refreshBvLayers(); } catch(e) { console.warn("refreshBvLayers error", e); }
            }
            alert('Le point choisi est bien sur un bassin versant topage');

            document.getElementById('toggle-controls').style.display = 'block';



        } else {
            alert('Le point choisi n\'est pas sur un BV Topage');
        }
    
        // Affichage du point de clic
        if (markerbv) {
            map.removeLayer(markerbv);
        }
        window.markerbv = L.marker([latlng.lat, latlng.lng], { icon: greenIcon }).addTo(map);
    })
    .catch(error => {
        console.error('Problème avec la requête fetch:', error);
    });

} else {   // Démarrer le timer pour le clic simple
    clickTimeout = setTimeout(function() {
        // Affichage de l'info-bulle
       /*  L.popup()
            .setLatLng(e.latlng)
            .setContent("Information sur le polygone")
            .openOn(map); */

        clickTimeout = null;
    }, doubleClickDelay);
}

});//fin onclick




/*             map.on('zoomend', function() {
                    var zoomLevel = map.getZoom();
                    document.getElementById('zoom-level').textContent = "Le niveau de zoom est de " + zoomLevel + ". Le niveau conseillé pour choisir un point est de 13 au moins.";
                }); */

//                                                                                                  SEND POST REQUEST FOR BV
//sendPostRequest(coords, map);

 
//                                                                   //                            //     EVENT DOWNLOAD  //
//////////////////////////////////////////////////////////////////////// 

document.getElementById('download-button').addEventListener('click', function() {
                    if (lastGeoJSON4326) {
                        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lastGeoJSON4326));
                        var downloadAnchorNode = document.createElement('a');
                        downloadAnchorNode.setAttribute("href", dataStr);
                        downloadAnchorNode.setAttribute("download", "bassin_versant_EPSG4326.geojson");
                        document.body.appendChild(downloadAnchorNode); // Required for Firefox
                        downloadAnchorNode.click();
                        downloadAnchorNode.remove();
                    } else {
                        alert("Aucun GeoJSON disponible à télécharger.");
                    }
                });
////////////////////////////////////////////////////////////////////////  EVENT TOPAGE DEPT

let topage41Layer = null;

document.getElementById('checkbox-41').addEventListener('change', function(event) {
    if (event.target.checked) {
        fetch('./topage41.json')
            .then(response => response.json())
            .then(data => {
                topage41Layer = L.geoJSON(data, {
                    style: function (feature) {
                        return { color: "#8B4513" };
                    }
                }).addTo(map);
            })
            .catch(error => console.error('Erreur lors du chargement du fichier topage41.json:', error));
    } else {
        if (topage41Layer) {
            map.removeLayer(topage41Layer);
        }
    }
});




//ecouteur STEP //dans fichier event
  

/////////
            

           
			


            document.getElementById('download-json-button').addEventListener('click', function() {
                if (jsonData) {
                    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonData));
                    var downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", dataStr);
                    downloadAnchorNode.setAttribute("download", "data.json");
                    document.body.appendChild(downloadAnchorNode);
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                } else {
                    alert('Aucune donnée JSON disponible pour le téléchargement.');
                }
            });

            document.getElementById('download-csv-button').addEventListener('click', function() {
                if (jsonData) {
                    var csvContent = "data:text/csv;charset=utf-8,";
                    var headers = ["latitude", "longitude", ...Object.keys(jsonData.features[0].properties)];
                    csvContent += headers.join(",") + "\n";

                    jsonData.features.forEach(feature => {
                        if (feature.geometry.type === "Point") {
                            var coords = feature.geometry.coordinates;
                            var properties = Object.values(feature.properties).map(value => `"${value}"`);
                            csvContent += [coords[1], coords[0], ...properties].join(",") + "\n";
                        }
                    });

                    var encodedUri = encodeURI(csvContent);
                    var downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", encodedUri);
                    downloadAnchorNode.setAttribute("download", "data.csv");
                    document.body.appendChild(downloadAnchorNode);
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                } else {
                    alert('Aucune donnée CSV disponible pour le téléchargement.');
                }
            });

           // fetchWFSData();

        }
    
    
    
    
    
        

    
    }
//FIN initializeMap();

      





        window.addEventListener('load', initializeMap);

        function enableGeolocation(map) {
    var geoMarker = null;  // Initialement aucun marqueur

    // Fonction pour afficher la position de l'utilisateur
    function onLocationFound(e) {
        var radius = e.accuracy / 2;

        // Si aucun marqueur n'existe, on le crée
        if (!geoMarker) {
            geoMarker = L.marker(e.latlng, {
                icon: L.icon({
                    iconUrl: 'https://unpkg.com/leaflet/dist/images/marker-icon.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34]
                })
            }).addTo(map);
        }

        // Mettre à jour la position et le contenu du popup
        geoMarker.setLatLng(e.latlng)
            .setPopupContent("Vous êtes ici. Précision: " + Math.round(radius) + " mètres.")
            .openPopup();

        // Centrer la carte sur la position de l'utilisateur
        map.setView(e.latlng, 13);
    }

    // Fonction appelée lorsque la géolocalisation échoue
    function onLocationError(e) {
        switch (e.code) {
            case 1:
                alert("L'utilisateur a refusé la demande de géolocalisation.");
                break;
            case 2:
                alert("La position est indisponible.");
                break;
            case 3:
                alert("Le délai d'attente pour obtenir la localisation a expiré.");
                break;
            default:
                alert("Une erreur inconnue s'est produite.");
        }
    }

    // Options de géolocalisation
    var geoOptions = {
        setView: true,
        maxZoom: 16,
        enableHighAccuracy: true, // Essayer d'obtenir la meilleure précision
        timeout: 10000, // Temps maximum avant d'abandonner (10s)
        maximumAge: 0 // Ne pas utiliser une position en cache
    };

    // Activer la géolocalisation
    map.locate(geoOptions);

    // Écouter les événements de géolocalisation
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);
}
       // var myRenderer = L.canvas({ padding: 0.5 });

// Gestion du chargement du fichier GeoJSON


    // Fonction pour créer le contenu du popup
    function createPopupContent(properties) {
        var content = '<b>Propriétés de l\'objet :</b><br>';
        for (var key in properties) {
            if (properties.hasOwnProperty(key)) {
                content += '<b>' + key + ':</b> ' + properties[key] + '<br>';
            }
        }
        return content;
    }


// Charger les données GeoJSON depuis le serveur
window.geojsonLayer;

