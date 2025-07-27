// Utility function to scroll to top of page
export const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'smooth'
  });
};

// Utility function to scroll to top instantly
export const scrollToTopInstant = () => {
  window.scrollTo(0, 0);
};