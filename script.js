// Configuración de Spotify
const clientId = '97d973ea484b40d592cbf2e18ca5fd5c'; // Reemplaza con tu Client ID de Spotify
const redirectUri = window.location.origin + window.location.pathname;
const scope = 'user-top-read user-read-private user-read-email';

// Almacenamiento de datos
let userProfileData = null;
let topArtists = [];
let topTracks = [];

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const museumScreen = document.getElementById('museum-screen');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const shareButton = document.getElementById('share-button');
const shareModal = document.getElementById('share-modal');
const closeModal = document.querySelector('.close-modal');
const downloadButton = document.getElementById('download-button');
const collageContainer = document.getElementById('collage-container');
const shareImageContainer = document.getElementById('share-image-container');

// Asegurarse de que el modal esté oculto inicialmente
shareModal.classList.add('hidden');

// Funciones de autenticación
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function getHashParams() {
    const hashParams = {};
    const r = /([^&;=]+)=?([^&;]*)/g;
    const q = window.location.hash.substring(1);
    let e;
    while ((e = r.exec(q))) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
}

function login() {
    const state = generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);

    const authorizeUrl = 'https://accounts.spotify.com/authorize?' +
        'response_type=token' +
        '&client_id=' + encodeURIComponent(clientId) +
        '&scope=' + encodeURIComponent(scope) +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&state=' + encodeURIComponent(state);

    window.location = authorizeUrl;
}

function logout() {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_auth_state');
    window.location.hash = '';
    showLoginScreen();
}

// Funciones de API de Spotify
async function fetchUserProfile(token) {
    const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    return await response.json();
}

async function fetchTopItems(token, type, limit = 50) {
    const response = await fetch(`https://api.spotify.com/v1/me/top/${type}?limit=${limit}&time_range=medium_term`, {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    return await response.json();
}

// Funciones de UI
function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    museumScreen.classList.add('hidden');
    // Asegurar que el modal esté oculto al mostrar la pantalla de login
    shareModal.classList.add('hidden');
}

function showMuseumScreen() {
    loginScreen.classList.add('hidden');
    museumScreen.classList.remove('hidden');
    // Asegurar que el modal esté oculto al mostrar la pantalla del museo
    shareModal.classList.add('hidden');
}

function createCollage() {
    collageContainer.innerHTML = '';
    
    // Combinar artistas y canciones
    const allItems = [];
    
    topArtists.forEach(artist => {
        if (artist.images && artist.images.length) {
            allItems.push({
                name: artist.name,
                type: 'artist',
                imageUrl: artist.images[0].url
            });
        }
    });
    
    topTracks.forEach(track => {
        if (track.album && track.album.images && track.album.images.length) {
            allItems.push({
                name: track.name,
                type: 'track',
                imageUrl: track.album.images[0].url
            });
        }
    });
    
    // Mezclar aleatoriamente
    allItems.sort(() => Math.random() - 0.5);
    
    // Crear elementos en el DOM
    allItems.forEach((item, index) => {
        const img = document.createElement('img');
        img.src = item.imageUrl;
        img.alt = item.name;
        img.title = item.name;
        img.className = 'album-cover';
        
        // Asignar tamaños diferentes para algunas imágenes
        if (index % 5 === 0) {
            img.style.gridColumn = 'span 2';
            img.style.gridRow = 'span 2';
        }
        
        collageContainer.appendChild(img);
    });
}

// Método alternativo para generar una imagen compartible
function generateShareImage() {
    // Mostrar mensaje de carga
    shareImageContainer.innerHTML = '<p>Preparando vista para compartir...</p>';
    
    try {
        // En lugar de intentar generar una imagen con html2canvas, creamos una vista
        // que se pueda compartir tal como está
        shareImageContainer.innerHTML = '';
        
        // Contenedor principal
        const shareView = document.createElement('div');
        shareView.style.width = '100%';
        shareView.style.maxWidth = '800px';
        shareView.style.margin = '0 auto';
        shareView.style.padding = '20px';
        shareView.style.backgroundColor = '#121212';
        shareView.style.color = '#ffffff';
        shareView.style.borderRadius = '10px';
        shareView.style.boxSizing = 'border-box';
        
        // Título
        const title = document.createElement('h2');
        title.textContent = 'Mi Museo Musical';
        title.style.fontSize = '2rem';
        title.style.color = '#1DB954';
        title.style.margin = '10px 0 20px';
        title.style.textAlign = 'center';
        shareView.appendChild(title);
        
        // Container para la galería
        const galleryContainer = document.createElement('div');
        galleryContainer.style.padding = '15px';
        galleryContainer.style.backgroundColor = '#282828';
        galleryContainer.style.borderRadius = '8px';
        galleryContainer.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.3)';
        
        // Grid para las imágenes
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
        grid.style.gap = '10px';
        
        // Seleccionar hasta 16 elementos para mostrar (combina artistas y tracks)
        const itemsToShow = [];
        
        // Primero, obtener algunos artistas principales
        const topArtistsToShow = topArtists
            .filter(artist => artist.images && artist.images.length)
            .slice(0, 8);
            
        // Luego, algunas canciones principales
        const topTracksToShow = topTracks
            .filter(track => track.album && track.album.images && track.album.images.length)
            .slice(0, 8);
        
        // Combinar y mezclar
        itemsToShow.push(...topArtistsToShow, ...topTracksToShow);
        itemsToShow.sort(() => Math.random() - 0.5);
        
        // Añadir elementos al grid
        itemsToShow.forEach((item, index) => {
            const imageUrl = item.images ? item.images[0].url : item.album.images[0].url;
            const name = item.name;
            
            const gridItem = document.createElement('div');
            gridItem.style.position = 'relative';
            gridItem.style.overflow = 'hidden';
            gridItem.style.borderRadius = '4px';
            gridItem.style.aspectRatio = '1';
            
            // Algunos elementos son más grandes
            if (index % 5 === 0) {
                gridItem.style.gridColumn = 'span 2';
                gridItem.style.gridRow = 'span 2';
            }
            
            // Fondo de color en lugar de imagen
            gridItem.style.backgroundColor = getRandomColor(name);
            
            // Texto con el nombre
            const nameLabel = document.createElement('div');
            nameLabel.textContent = name;
            nameLabel.style.position = 'absolute';
            nameLabel.style.bottom = '0';
            nameLabel.style.left = '0';
            nameLabel.style.right = '0';
            nameLabel.style.padding = '8px';
            nameLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            nameLabel.style.color = '#fff';
            nameLabel.style.fontSize = '12px';
            nameLabel.style.whiteSpace = 'nowrap';
            nameLabel.style.overflow = 'hidden';
            nameLabel.style.textOverflow = 'ellipsis';
            
            gridItem.appendChild(nameLabel);
            grid.appendChild(gridItem);
        });
        
        galleryContainer.appendChild(grid);
        shareView.appendChild(galleryContainer);
        
        // Pie de página
        const footer = document.createElement('p');
        footer.textContent = 'Creado en nam3.es con mis favoritos de Spotify';
        footer.style.fontSize = '0.9rem';
        footer.style.margin = '15px 0 0';
        footer.style.textAlign = 'center';
        footer.style.color = '#aaa';
        shareView.appendChild(footer);
        
        // Usuario
        if (userProfileData && userProfileData.display_name) {
            const userInfo = document.createElement('p');
            userInfo.textContent = `Por ${userProfileData.display_name}`;
            userInfo.style.fontSize = '1rem';
            userInfo.style.margin = '5px 0';
            userInfo.style.textAlign = 'center';
            userInfo.style.color = '#1DB954';
            shareView.appendChild(userInfo);
        }
        
        // Añadir la vista completa al contenedor
        shareImageContainer.appendChild(shareView);
        
        // En lugar de html2canvas, usamos captura de pantalla nativa
        const screenshotInstructions = document.createElement('div');
        screenshotInstructions.style.margin = '20px auto';
        screenshotInstructions.style.padding = '15px';
        screenshotInstructions.style.backgroundColor = '#333';
        screenshotInstructions.style.borderRadius = '8px';
        screenshotInstructions.style.textAlign = 'center';
        
        screenshotInstructions.innerHTML = `
            <p>Para compartir tu museo musical, toma una captura de pantalla:</p>
            <ul style="text-align: left; list-style-position: inside;">
                <li>En Windows: Pulsa <strong>Windows + Shift + S</strong></li>
                <li>En Mac: Pulsa <strong>Command + Shift + 4</strong></li>
                <li>En smartphones: Pulsa los botones de encendido + volumen</li>
            </ul>
        `;
        
        shareImageContainer.appendChild(screenshotInstructions);
        
        // Configurar el botón de descarga para hacer scroll a la vista
        downloadButton.textContent = 'Preparar para captura';
        downloadButton.onclick = () => {
            // Hacer scroll a la vista para que sea más fácil capturarla
            shareView.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Opcional: resaltar brevemente para indicar que está listo para capturar
            shareView.style.boxShadow = '0 0 0 3px #1DB954';
            setTimeout(() => {
                shareView.style.boxShadow = 'none';
            }, 1000);
        };
        
    } catch (error) {
        console.error('Error generando la vista para compartir:', error);
        shareImageContainer.innerHTML = '<p>Ha ocurrido un error. Por favor intenta de nuevo.</p>';
    }
}

// Función para generar un color aleatorio pero consistente basado en un texto
function getRandomColor(text) {
    // Crear un hash simple del texto
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convertir a color hexadecimal
    const hue = Math.abs(hash % 360);
    const saturation = 60 + Math.abs((hash >> 8) % 20); // 60-80%
    const lightness = 45 + Math.abs((hash >> 16) % 10); // 45-55%
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Event listeners - Mejorar manejo de eventos para el modal
loginButton.addEventListener('click', login);
logoutButton.addEventListener('click', logout);

// Evento para mostrar el modal
shareButton.addEventListener('click', () => {
    shareModal.classList.remove('hidden');
    generateShareImage();
});

// Múltiples formas de cerrar el modal
closeModal.addEventListener('click', () => {
    shareModal.classList.add('hidden');
});

// Cerrar el modal haciendo clic fuera de su contenido
shareModal.addEventListener('click', (event) => {
    if (event.target === shareModal) {
        shareModal.classList.add('hidden');
    }
});

// Cerrar el modal con la tecla Escape
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !shareModal.classList.contains('hidden')) {
        shareModal.classList.add('hidden');
    }
});

// Inicialización
window.addEventListener('load', async () => {
    // Asegurar que el modal esté oculto al cargar la página
    shareModal.classList.add('hidden');
    
    // Comprobar si hay token en la URL (después de autenticación)
    const params = getHashParams();
    const token = params.access_token;
    
    if (token) {
        // Guardar token
        localStorage.setItem('spotify_access_token', token);
        // Limpiar URL
        window.location.hash = '';
        
        try {
            // Obtener datos del usuario y elementos top
            userProfileData = await fetchUserProfile(token);
            
            const artistsData = await fetchTopItems(token, 'artists', 30);
            topArtists = artistsData.items || [];
            
            const tracksData = await fetchTopItems(token, 'tracks', 30);
            topTracks = tracksData.items || [];
            
            // Crear collage y mostrar pantalla del museo
            createCollage();
            showMuseumScreen();
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Ha ocurrido un error al conectar con Spotify. Por favor, inténtalo de nuevo.');
            logout();
        }
    } else {
        // Comprobar si hay token guardado
        const savedToken = localStorage.getItem('spotify_access_token');
        if (savedToken) {
            try {
                // Verificar que el token sigue siendo válido
                userProfileData = await fetchUserProfile(savedToken);
                
                const artistsData = await fetchTopItems(savedToken, 'artists', 30);
                topArtists = artistsData.items || [];
                
                const tracksData = await fetchTopItems(savedToken, 'tracks', 30);
                topTracks = tracksData.items || [];
                
                createCollage();
                showMuseumScreen();
            } catch (error) {
                console.error('Error con el token guardado:', error);
                logout();
            }
        } else {
            showLoginScreen();
        }
    }
});