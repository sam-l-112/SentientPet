document.addEventListener('DOMContentLoaded', function() {
    const petButtons = document.querySelectorAll('.pet-option button');

    petButtons.forEach(button => {
        button.addEventListener('click', function() {
            const selectedPet = this.dataset.pet;
            localStorage.setItem('selectedPet', selectedPet);
            window.location.href = '../index.html';
        });
    });
});
