// 零屿笔记官网交互脚本

// 添加平滑滚动效果
function smoothScroll(target, duration) {
    const targetElement = document.querySelector(target);
    const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY;
    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = ease(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    function ease(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
}

// 添加视差滚动效果
function parallaxScroll() {
    const scrolled = window.scrollY;

    // 英雄区域视差效果
    document.querySelectorAll('.hero-image').forEach(element => {
        const speed = 0.2;
        element.style.transform = `translateY(${scrolled * speed}px)`;
    });

    // 功能展示区域视差效果
    document.querySelectorAll('.app-showcase').forEach((element, index) => {
        const position = element.getBoundingClientRect().top;
        const screenPosition = window.innerHeight / 1.3;

        if (position < screenPosition) {
            element.style.opacity = '1';
            if (index % 2 === 0) {
                element.querySelector('.showcase-content').style.transform = 'translateX(0)';
                element.querySelector('.showcase-image').style.transform = 'translateX(0)';
            } else {
                element.querySelector('.showcase-content').style.transform = 'translateX(0)';
                element.querySelector('.showcase-image').style.transform = 'translateX(0)';
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // 初始化滑块器
    initSlider();

    // 初始化滑块器函数
    function initSlider() {
        const slider = document.querySelector('.slider');
        const slides = document.querySelectorAll('.slide');
        const dotsContainer = document.querySelector('.slider-dots');
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');
        let currentIndex = 0;
        const slideCount = slides.length;

        // 创建指示点
        slides.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (index === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(index));
            dotsContainer.appendChild(dot);
        });

        const dots = document.querySelectorAll('.dot');

        // 上一张按钮
        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + slideCount) % slideCount;
            updateSlider();
        });

        // 下一张按钮
        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % slideCount;
            updateSlider();
        });

        // 自动播放
        let autoplayInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % slideCount;
            updateSlider();
        }, 5000);

        // 鼠标悬停时暂停自动播放
        const sliderContainer = document.querySelector('.slider-container');
        sliderContainer.addEventListener('mouseenter', () => {
            clearInterval(autoplayInterval);
        });

        sliderContainer.addEventListener('mouseleave', () => {
            autoplayInterval = setInterval(() => {
                currentIndex = (currentIndex + 1) % slideCount;
                updateSlider();
            }, 5000);
        });

        // 触摸滑动支持
        let touchStartX = 0;
        let touchEndX = 0;

        sliderContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        sliderContainer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });

        function handleSwipe() {
            const swipeThreshold = 50;
            if (touchEndX < touchStartX - swipeThreshold) {
                // 左滑
                currentIndex = (currentIndex + 1) % slideCount;
                updateSlider();
            } else if (touchEndX > touchStartX + swipeThreshold) {
                // 右滑
                currentIndex = (currentIndex - 1 + slideCount) % slideCount;
                updateSlider();
            }
        }

        // 更新滑块器状态
        function updateSlider() {
            slider.style.transform = `translateX(-${currentIndex * 100}%)`;

            // 更新指示点
            dots.forEach((dot, index) => {
                if (index === currentIndex) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }

        // 跳转到指定幻灯片
        function goToSlide(index) {
            currentIndex = index;
            updateSlider();
        }
    }
    // 导航栏滚动效果
    const header = document.querySelector('.header');
    const navLinks = document.querySelectorAll('.nav a');
    const sections = document.querySelectorAll('section');

    // 滚动时改变导航栏样式
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            header.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
        }

        // 高亮当前滚动位置对应的导航项
        let currentSection = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;

            if (window.scrollY >= (sectionTop - 200)) {
                currentSection = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    });

    // 导航链接点击平滑滚动
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            if (targetId.startsWith('#')) {
                const targetSection = document.querySelector(targetId);
                if (targetSection) {
                    smoothScroll(targetId, 1000);
                }
            }
        });
    });

    // 特性卡片动画
    const featureCards = document.querySelectorAll('.feature-card');

    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
            this.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.1)';
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
    });

    // 下载选项动画
    const downloadOptions = document.querySelectorAll('.download-option');

    downloadOptions.forEach(option => {
        option.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
            this.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.1)';
        });

        option.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
    });

    // 添加视差滚动效果
    window.addEventListener('scroll', parallaxScroll);

    // 初始化时执行一次视差效果
    parallaxScroll();

    // 添加鼠标跟随效果
    document.addEventListener('mousemove', function(e) {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;

        document.querySelectorAll('.hero-image-bg').forEach(bg => {
            bg.style.transform = `translate(${mouseX * 20}px, ${mouseY * 20}px)`;
        });
    });

    // 添加滚动显示动画
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver(function(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .showcase-content, .showcase-image').forEach(el => {
        observer.observe(el);
    });
});
