// Masks sensitive Mobile Money numbers in student responses (NFR-03)
const maskPhoneNumber = (phone) => {
    if (!phone || phone.length < 10) return '***';
    // e.g. +256771234567 -> +25677***4567
    return phone.substring(0, 6) + '***' + phone.substring(phone.length - 4);
};

module.exports = { maskPhoneNumber };
