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

async function generateShareImage() {
    // Crear un contenedor temporal para la imagen
    const tempContainer = document.createElement('div');
    tempContainer.style.width = '900px';
    tempContainer.style.padding = '20px';
    tempContainer.style.backgroundColor = '#121212';
    tempContainer.style.color = '#ffffff';
    tempContainer.style.display = 'flex';
    tempContainer.style.flexDirection = 'column';
    tempContainer.style.alignItems = 'center';
    
    // Título
    const title = document.createElement('h1');
    title.textContent = 'Museo Musical';
    title.style.fontSize = '3rem';
    title.style.color = '#1DB954';
    title.style.margin = '20px 0';
    tempContainer.appendChild(title);
    
    // Clonar el marco y el collage
    const frameClone = document.querySelector('.museum-frame').cloneNode(true);
    frameClone.style.width = '800px';
    tempContainer.appendChild(frameClone);
    
    // Añadir texto de nam3.es
    const footer = document.createElement('p');
    footer.textContent = 'nam3.es';
    footer.style.fontSize = '1.5rem';
    footer.style.margin = '20px 0';
    tempContainer.appendChild(footer);
    
    // Añadir temporalmente al DOM para poder capturar
    document.body.appendChild(tempContainer);
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    
    // Generar imagen
    try {
        const canvas = await html2canvas(tempContainer, {
            allowTaint: true,
            useCORS: true,
            scale: 1
        });
        
        const imageUrl = canvas.toDataURL('image/png');
        
        // Mostrar la imagen generada
        shareImageContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Museo Musical Compartible';
        shareImageContainer.appendChild(img);
        
        // Configurar el botón de descarga
        downloadButton.onclick = () => {
            const link = document.createElement('a');
            link.download = 'mi-museo-musical.png';
            link.href = imageUrl;
            link.click();
        };
        
    } catch (error) {
        console.error('Error generando la imagen:', error);
        shareImageContainer.innerHTML = '<p>Ha ocurrido un error generando la imagen.</p>';
    }
    
    // Eliminar el contenedor temporal
    document.body.removeChild(tempContainer);
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