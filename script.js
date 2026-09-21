// ==========================================================================
// IMPORTAÇÃO E CONFIGURAÇÃO DO FIREBASE (NUVEM)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurações do seu projeto Firebase Real Veículos
const firebaseConfig = {
    apiKey: "AIzaSyB9qJkpKr3ch5BCL4xwQcvfwLpbX31w5tI",
    authDomain: "real-veiculos-7ddb9.firebaseapp.com",
    projectId: "real-veiculos-7ddb9",
    storageBucket: "real-veiculos-7ddb9.firebasestorage.app",
    messagingSenderId: "106904646145",
    appId: "1:106904646145:web:54bec9863b53538cbb0600"
};

// Inicialização do Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const vehiclesCollection = collection(db, "veiculos");

// ==========================================================================
// CONFIGURAÇÕES DE AUTENTICAÇÃO E ESTADO
// ==========================================================================
const ADMIN_PASSWORD = "real123";
let isAdminLoggedIn = false;

let cars = [];
let currentModalImages = [];
let currentModalIndex = 0;

let touchStartX = 0;
let touchEndX = 0;

// Elementos do DOM
const carGrid = document.getElementById('car-grid');
const adminSection = document.getElementById('admin-section');
const adminToggleBtn = document.getElementById('admin-toggle-btn');
const closeAdminBtn = document.getElementById('close-admin-btn');
const carForm = document.getElementById('car-form');
const formTitle = document.getElementById('form-title');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Elementos de Filtro
const searchInput = document.getElementById('search-input');
const brandFilter = document.getElementById('brand-filter');
const bodyFilter = document.getElementById('body-filter');

// ==========================================================================
// SINCRONIZAÇÃO EM TEMPO REAL (FIRESTORE)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    onSnapshot(vehiclesCollection, (snapshot) => {
        cars = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        renderCars();
    }, (error) => {
        console.error("Erro ao sincronizar com o Firebase:", error);
    });

    setupEventListeners();
});

function setupEventListeners() {
    adminToggleBtn.addEventListener('click', () => {
        if (!isAdminLoggedIn) {
            const passwordInput = prompt("Digite a palavra-passe de administrador:");
            if (passwordInput === ADMIN_PASSWORD) {
                isAdminLoggedIn = true;
                adminToggleBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair do Admin';
                adminSection.classList.remove('hidden');
                renderCars();
            } else if (passwordInput !== null) {
                alert("Palavra-passe incorreta!");
            }
        } else {
            isAdminLoggedIn = false;
            adminToggleBtn.innerHTML = '<i class="fas fa-lock"></i> Entrar como Admin';
            adminSection.classList.add('hidden');
            resetForm();
            renderCars();
        }
    });

    closeAdminBtn.addEventListener('click', () => {
        adminSection.classList.add('hidden');
        resetForm();
    });

    cancelEditBtn.addEventListener('click', resetForm);
    carForm.addEventListener('submit', handleFormSubmit);

    searchInput.addEventListener('input', renderCars);
    brandFilter.addEventListener('change', renderCars);
    bodyFilter.addEventListener('change', renderCars);
}

// ==========================================================================
// COMPRESSÃO RIGOROSA COM LIMITE ESTRITO (GARANTE < 1MB TOTAL)
// ==========================================================================
function compressSingleImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width = Math.round((width * maxWidth) / height);
                        height = maxWidth;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// Algoritmo adaptativo que força as imagens a caberem em menos de 800 KB total
async function processSelectedImages(files) {
    const total = files.length;
    let maxWidth = 600;
    let quality = 0.4;

    if (total >= 8) {
        maxWidth = 400;
        quality = 0.25;
    } else if (total >= 5) {
        maxWidth = 480;
        quality = 0.3;
    } else if (total >= 3) {
        maxWidth = 550;
        quality = 0.35;
    }

    let results = await Promise.all(Array.from(files).map(f => compressSingleImage(f, maxWidth, quality)));
    
    // Teste de tamanho do payload
    let totalSize = new Blob([JSON.stringify(results)]).size;
    
    // Se ainda assim passar de 800KB (para margem de segurança do Firestore de 1MB), comprime numa 2ª passagem
    if (totalSize > 800000) {
        maxWidth = Math.round(maxWidth * 0.75);
        quality = 0.25;
        results = await Promise.all(Array.from(files).map(f => compressSingleImage(f, maxWidth, quality)));
    }

    return results;
}

// Submeter Formulário
async function handleFormSubmit(e) {
    e.preventDefault();

    if (!isAdminLoggedIn) {
        alert("Sessão expirada. Faça login de administrador novamente.");
        return;
    }

    const submitBtn = carForm.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A guardar na nuvem...';
    submitBtn.disabled = true;

    try {
        const carId = document.getElementById('car-id').value;
        const title = document.getElementById('car-title-input').value;
        const brand = document.getElementById('car-brand-input').value;
        const type = document.getElementById('car-type-input').value;
        const year = document.getElementById('car-year-input').value;
        const km = document.getElementById('car-km-input').value;
        const price = document.getElementById('car-price-input').value;
        const imageInput = document.getElementById('car-image-input');

        let images = [];
        if (imageInput.files && imageInput.files.length > 0) {
            images = await processSelectedImages(imageInput.files);
        }

        const carData = {
            title: title || '',
            brand: brand || '',
            type: type || '',
            year: year || '',
            km: km || '',
            price: price || '',
            images: images.length > 0 ? images : (carId ? (cars.find(c => c.id === carId)?.images || []) : ["https://via.placeholder.com/600x400?text=Sem+Foto"]),
            updatedAt: new Date().toISOString()
        };

        if (carId) {
            const vehicleRef = doc(db, "veiculos", carId);
            await updateDoc(vehicleRef, carData);
            alert('Veículo atualizado com sucesso na nuvem!');
        } else {
            carData.createdAt = new Date().toISOString();
            await addDoc(vehiclesCollection, carData);
            alert('Novo veículo cadastrado com sucesso!');
        }

        resetForm();
    } catch (error) {
        console.error("Erro ao guardar no Firebase:", error);
        alert(`FALHA AO GUARDAR NO FIREBASE:\n\nCódigo: ${error.code || 'Desconhecido'}\nMensagem: ${error.message || error}`);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Renderizar o Catálogo no Ecrã
function renderCars() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedBrand = brandFilter.value;
    const selectedBody = bodyFilter.value;

    const filteredCars = cars.filter(car => {
        const matchesSearch = (car.title || '').toLowerCase().includes(searchTerm) || (car.brand || '').toLowerCase().includes(searchTerm);
        const matchesBrand = selectedBrand === 'all' || car.brand === selectedBrand;
        const matchesBody = selectedBody === 'all' || car.type === selectedBody;
        return matchesSearch && matchesBrand && matchesBody;
    });

    carGrid.innerHTML = '';

    if (filteredCars.length === 0) {
        carGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #a1a1aa; padding: 40px;">Nenhum veículo encontrado no catálogo.</p>`;
        return;
    }

    filteredCars.forEach(car => {
        const carCard = createCarCard(car);
        carGrid.appendChild(carCard);
    });
}

function createCarCard(car) {
    const card = document.createElement('div');
    card.className = 'car-card';

    const imagesList = Array.isArray(car.images) && car.images.length > 0 ? car.images : ["https://via.placeholder.com/600x400?text=Sem+Foto"];

    let carouselHTML = '';
    if (imagesList.length > 1) {
        carouselHTML = `
            <div class="car-carousel">
                ${imagesList.map((img, idx) => `
                    <div class="carousel-slide ${idx === 0 ? 'active' : ''}">
                        <img src="${img}" alt="${car.title}" onclick="openImageModal('${car.id}',${idx})" style="cursor: pointer;" title="Clique para ampliar">
                    </div>
                `).join('')}
                <button type="button" class="carousel-btn prev" onclick="moveSlide(event, -1)"><i class="fas fa-chevron-left"></i></button>
                <button type="button" class="carousel-btn next" onclick="moveSlide(event, 1)"><i class="fas fa-chevron-right"></i></button>
                <div class="carousel-dots">
                    ${imagesList.map((_, idx) => `<span class="dot ${idx === 0 ? 'active' : ''}"></span>`).join('')}
                </div>
            </div>
        `;
    } else {
        carouselHTML = `
            <div class="car-carousel">
                <div class="carousel-slide active">
                    <img src="${imagesList[0]}" alt="${car.title}" onclick="openImageModal('${car.id}', 0)" style="cursor: pointer;" title="Clique para ampliar">
                </div>
            </div>
        `;
    }

    const whatsappMessage = encodeURIComponent(`Olá! Tenho interesse no veículo ${car.title} (R$ ${car.price}). Poderia me dar mais informações?`);

    const adminButtonsHTML = isAdminLoggedIn ? `
        <div class="admin-card-actions">
            <button type="button" class="btn-edit" onclick="editCar('${car.id}')"><i class="fas fa-edit"></i> Editar</button>
            <button type="button" class="btn-delete" onclick="deleteCar('${car.id}')"><i class="fas fa-trash"></i> Excluir</button>
        </div>
    ` : '';

    card.innerHTML = `
        <span class="card-tag">${car.type || 'Veículo'}</span>
        ${carouselHTML}
        <div class="car-info">
            <h3 class="car-title">${car.title}</h3>
            <div class="car-price">R$ ${car.price}</div>
            <div class="car-details">
                <span><i class="far fa-calendar-alt"></i> ${car.year}</span>
                <span><i class="fas fa-tachometer-alt"></i> ${car.km}</span>
            </div>
            <div class="car-actions">
                <a href="https://wa.me/5566992555125?text=${whatsappMessage}" target="_blank" class="btn-whatsapp">
                    <i class="fab fa-whatsapp"></i> Tenho Interesse
                </a>
                ${adminButtonsHTML}
            </div>
        </div>
    `;

    return card;
}

// Funções do Carrossel dos Cartões
window.moveSlide = function(event, direction) {
    const card = event.target.closest('.car-card');
    const slides = card.querySelectorAll('.carousel-slide');
    const dots = card.querySelectorAll('.dot');
    let activeIndex = Array.from(slides).findIndex(s => s.classList.contains('active'));

    slides[activeIndex].classList.remove('active');
    if (dots.length) dots[activeIndex].classList.remove('active');

    activeIndex += direction;
    if (activeIndex < 0) activeIndex = slides.length - 1;
    if (activeIndex >= slides.length) activeIndex = 0;

    slides[activeIndex].classList.add('active');
    if (dots.length) dots[activeIndex].classList.add('active');
};

// Modal Lightbox com Gestos Touch (Swipe)
window.openImageModal = function(carId, imageIndex) {
    const car = cars.find(c => c.id === carId);
    if (!car || !car.images || car.images.length === 0) return;

    currentModalImages = car.images;
    currentModalIndex = imageIndex;

    let modal = document.getElementById('image-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-modal';
        modal.className = 'image-modal';
        modal.innerHTML = `
            <span class="close-modal" onclick="closeImageModal()">&times;</span>
            <img class="modal-content" id="img-modal-target" src="" alt="Foto Ampliada">
            <div class="modal-counter" id="modal-counter"></div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeImageModal();
        });

        modal.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        modal.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleModalSwipe();
        }, { passive: true });
    }

    updateModalImage();
    modal.classList.add('show');
};

function handleModalSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    const minSwipeDistance = 40;

    if (Math.abs(swipeDistance) > minSwipeDistance) {
        if (swipeDistance < 0) {
            navigateModalImage(1);
        } else {
            navigateModalImage(-1);
        }
    }
}

function updateModalImage() {
    const targetImg = document.getElementById('img-modal-target');
    const counter = document.getElementById('modal-counter');

    if (targetImg) {
        targetImg.src = currentModalImages[currentModalIndex];
    }

    if (counter) {
        counter.textContent = `${currentModalIndex + 1} / ${currentModalImages.length}`;
    }
}

window.navigateModalImage = function(direction) {
    if (currentModalImages.length <= 1) return;

    currentModalIndex += direction;
    if (currentModalIndex < 0) {
        currentModalIndex = currentModalImages.length - 1;
    } else if (currentModalIndex >= currentModalImages.length) {
        currentModalIndex = 0;
    }

    updateModalImage();
};

window.closeImageModal = function() {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.classList.remove('show');
    }
};

window.editCar = function(id) {
    if (!isAdminLoggedIn) return;
    const car = cars.find(c => c.id === id);
    if (!car) return;

    document.getElementById('car-id').value = car.id;
    document.getElementById('car-title-input').value = car.title;
    document.getElementById('car-brand-input').value = car.brand;
    document.getElementById('car-type-input').value = car.type;
    document.getElementById('car-year-input').value = car.year;
    document.getElementById('car-km-input').value = car.km;
    document.getElementById('car-price-input').value = car.price;

    formTitle.textContent = "Editar Veículo";
    cancelEditBtn.classList.remove('hidden');
    adminSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteCar = async function(id) {
    if (!isAdminLoggedIn) return;
    if (confirm('Tem certeza que deseja excluir este veículo da nuvem?')) {
        try {
            await deleteDoc(doc(db, "veiculos", id));
            alert('Veículo removido com sucesso!');
        } catch (error) {
            console.error("Erro ao apagar veículo:", error);
            alert("Erro ao remover o veículo do Firebase.");
        }
    }
};

function resetForm() {
    carForm.reset();
    document.getElementById('car-id').value = '';
    formTitle.textContent = "Cadastrar Novo Veículo";
    cancelEditBtn.classList.add('hidden');
}
