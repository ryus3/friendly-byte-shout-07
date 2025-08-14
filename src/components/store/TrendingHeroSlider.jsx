import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronLeft, Star, Heart, ShoppingCart, Sparkles, TrendingUp } from 'lucide-react';

const TrendingHeroSlider = ({ 
  slides = [], 
  autoPlay = true, 
  autoPlayDelay = 5000,
  onProductClick = () => {},
  onCTAClick = () => {}
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);

  // Default slides data
  const defaultSlides = [
    {
      id: 1,
      background: {
        type: 'gradient',
        value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      },
      title: 'تريندات الموسم',
      hashtag: '#PowderedRose',
      subtitle: 'اكتشفي أحدث صيحات الموضة',
      description: 'مجموعة حصرية من الفساتين العصرية',
      ctaText: 'تسوقي الآن',
      products: [
        {
          id: 1,
          image: '/lovable-uploads/bac667e8-50c1-4921-bccf-bf3a3ec4ca69.png',
          price: '$19.00',
          originalPrice: '$35.00',
          position: { top: '20%', right: '10%' }
        },
        {
          id: 2,
          image: '/lovable-uploads/bac667e8-50c1-4921-bccf-bf3a3ec4ca69.png',
          price: '$30.20',
          originalPrice: '$45.00',
          position: { top: '40%', right: '5%' }
        }
      ],
      mainProductImage: '/lovable-uploads/bac667e8-50c1-4921-bccf-bf3a3ec4ca69.png'
    },
    {
      id: 2,
      background: {
        type: 'gradient',
        value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
      },
      title: 'عروض حصرية',
      hashtag: '#SummerVibes',
      subtitle: 'خصومات تصل إلى 70%',
      description: 'مجموعة مميزة من الأزياء الصيفية',
      ctaText: 'اكتشفي المزيد',
      products: [
        {
          id: 3,
          image: '/lovable-uploads/bac667e8-50c1-4921-bccf-bf3a3ec4ca69.png',
          price: '$25.00',
          originalPrice: '$50.00',
          position: { top: '25%', right: '8%' }
        }
      ],
      mainProductImage: '/lovable-uploads/bac667e8-50c1-4921-bccf-bf3a3ec4ca69.png'
    }
  ];

  const slidesData = slides.length > 0 ? slides : defaultSlides;

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slidesData.length);
    }, autoPlayDelay);

    return () => clearInterval(interval);
  }, [currentSlide, isAutoPlaying, autoPlayDelay, slidesData.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slidesData.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slidesData.length) % slidesData.length);
  };

  const currentSlideData = slidesData[currentSlide];

  return (
    <div 
      className="relative h-[400px] md:h-[500px] lg:h-[600px] overflow-hidden rounded-2xl mx-4 md:mx-6 lg:mx-8 shadow-2xl"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(autoPlay)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full"
          style={{
            background: currentSlideData?.background?.type === 'gradient' 
              ? currentSlideData.background.value 
              : `url(${currentSlideData?.background?.value}) center/cover`
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

          {/* Animated Background Elements */}
          <div className="absolute inset-0">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-white/30 rounded-full"
                initial={{ 
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight,
                  scale: 0
                }}
                animate={{ 
                  y: [null, -20, 0],
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 0.5,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>

          {/* Content Container */}
          <div className="relative z-10 h-full flex items-center justify-between px-6 md:px-12 lg:px-16">
            
            {/* Left Content */}
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex-1 max-w-lg"
            >
              {/* Trending Badge */}
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, delay: 0.4, type: "spring" }}
                className="mb-4"
              >
                <Badge className="bg-white/20 backdrop-blur-md text-white border-white/30 px-4 py-2 text-sm font-almarai font-bold">
                  <TrendingUp className="w-4 h-4 ml-2" />
                  {currentSlideData?.title}
                </Badge>
              </motion.div>

              {/* Hashtag */}
              <motion.h1
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="text-4xl md:text-5xl lg:text-6xl font-almarai font-black text-white mb-4 tracking-tight"
              >
                {currentSlideData?.hashtag}
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-block mr-2"
                >
                  <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-yellow-300" />
                </motion.span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="text-xl md:text-2xl font-ibm-arabic font-semibold text-white/90 mb-2"
              >
                {currentSlideData?.subtitle}
              </motion.p>

              {/* Description */}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
                className="text-lg font-tajawal text-white/80 mb-8 leading-relaxed"
              >
                {currentSlideData?.description}
              </motion.p>

              {/* CTA Button */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                <Button
                  onClick={() => onCTAClick(currentSlideData)}
                  size="lg"
                  className="bg-white text-purple-600 hover:bg-white/90 font-almarai font-bold text-lg px-8 py-6 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
                >
                  {currentSlideData?.ctaText}
                  <ChevronLeft className="w-5 h-5 mr-2" />
                </Button>
              </motion.div>
            </motion.div>

            {/* Right Content - Main Product */}
            <motion.div
              initial={{ x: 100, opacity: 0, rotate: 10 }}
              animate={{ x: 0, opacity: 1, rotate: 0 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="hidden md:flex relative flex-1 justify-center items-center"
            >
              {/* Main Product Image */}
              <motion.div
                animate={{ 
                  y: [0, -20, 0],
                  rotate: [0, 2, -2, 0]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative z-10"
              >
                <img
                  src={currentSlideData?.mainProductImage}
                  alt="منتج مميز"
                  className="w-64 h-80 lg:w-80 lg:h-96 object-cover rounded-3xl shadow-2xl"
                />
                
                {/* Floating Heart */}
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute top-4 right-4 w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30"
                >
                  <Heart className="w-6 h-6 text-white" />
                </motion.button>
              </motion.div>

              {/* Floating Product Cards */}
              {currentSlideData?.products?.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ scale: 0, rotate: 45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ 
                    duration: 0.6, 
                    delay: 0.9 + index * 0.2,
                    type: "spring",
                    stiffness: 100
                  }}
                  whileHover={{ scale: 1.05, y: -10 }}
                  onClick={() => onProductClick(product)}
                  className="absolute cursor-pointer"
                  style={{ 
                    top: product.position.top, 
                    right: product.position.right 
                  }}
                >
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-3 border border-white/20 shadow-xl">
                    <img
                      src={product.image}
                      alt="منتج"
                      className="w-16 h-20 object-cover rounded-xl mb-2"
                    />
                    <div className="text-center">
                      <div className="text-white font-bold text-sm font-almarai">
                        {product.price}
                      </div>
                      {product.originalPrice && (
                        <div className="text-white/60 text-xs line-through font-tajawal">
                          {product.originalPrice}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Navigation Controls */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
            {/* Slide Indicators */}
            <div className="flex gap-2">
              {slidesData.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentSlide 
                      ? 'bg-white scale-125' 
                      : 'bg-white/50 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Arrow Navigation */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all duration-300"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
          
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all duration-300"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TrendingHeroSlider;