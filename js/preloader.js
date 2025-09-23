// 真实资源加载检测的预加载界面
(function() {
    'use strict';
    
    const preloader = {
        element: null,
        progressBar: null,
        progressText: null,
        totalResources: 0,
        loadedResources: 0,
        resources: [],
        
        init: function() {
        this.element = document.getElementById('preloader');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        
        if (!this.element) return;
        
        // 在移动端确保预加载页面可见
        this.ensureMobileVisibility();
        
        // 开始真实的资源加载检测
        this.startRealLoading();
    },
    
    ensureMobileVisibility: function() {
        // 移动端兼容：强制设置可见性
        if (this.element) {
            this.element.style.visibility = 'visible';
            this.element.style.display = 'block';
            this.element.style.opacity = '1';
        }
    },
        
        startRealLoading: function() {
            this.updateProgress(0, '正在检测资源...');
            
            // 收集所有需要加载的资源
            this.collectResources();
            
            if (this.totalResources === 0) {
                // 如果没有检测到资源，使用默认的延迟隐藏
                this.simulateRealLoading();
                return;
            }
            
            // 开始监控资源加载
            this.monitorResources();
            
            // 强制在window.load事件时隐藏，确保所有资源加载完成
            const self = this;
            window.addEventListener('load', function() {
                setTimeout(() => {
                    self.finalizeLoading();
                }, 300);
            });
        },
        
        collectResources: function() {
            // ⚡ 优化：只检测核心功能所需的JS文件
            const criticalScripts = [
                'handle-click-event.js',
                'notification-system.js',
                'videoErrorHandler.js'
            ];
            
            // 只收集关键的脚本资源
            const scripts = document.querySelectorAll('script[src]');
            scripts.forEach(script => {
                const src = script.src;
                // 检查是否是核心JS文件
                const isCritical = criticalScripts.some(file => src.includes(file));
                if (isCritical) {
                    this.resources.push({ type: 'script', src: src, element: script });
                }
            });
            
            // 设置最小资源数，避免空检测
            this.totalResources = Math.max(this.resources.length, 1);
            console.log(`检测到 ${this.totalResources} 个核心资源需要加载`);
        },
        
        monitorResources: function() {
            if (this.totalResources === 0) {
                this.hide();
                return;
            }
            
            this.loadedResources = 0;
            
            this.resources.forEach(resource => {
                this.loadResource(resource);
            });
            
            // 同时监听文档加载状态
            this.documentReadyCheck();
        },
        
        loadResource: function(resource) {
            const self = this;
            
            // 创建新的加载器来检测资源状态
            let loader;
            
            switch(resource.type) {
                case 'image':
                    loader = new Image();
                    loader.onload = function() {
                        self.onResourceLoaded(resource);
                    };
                    loader.onerror = function() {
                        self.onResourceLoaded(resource); // 错误也算作加载完成
                    };
                    loader.src = resource.src;
                    break;
                    
                case 'script':
                case 'stylesheet':
                    // 对于已经存在的脚本和样式表，检查它们的加载状态
                    if (resource.element.complete !== undefined) {
                        // 某些浏览器支持complete属性
                        if (resource.element.complete) {
                            this.onResourceLoaded(resource);
                        } else {
                            resource.element.onload = function() {
                                self.onResourceLoaded(resource);
                            };
                            resource.element.onerror = function() {
                                self.onResourceLoaded(resource);
                            };
                        }
                    } else {
                        // 创建新的加载器
                        loader = document.createElement(resource.type === 'script' ? 'script' : 'link');
                        if (resource.type === 'stylesheet') {
                            loader.rel = 'stylesheet';
                        }
                        loader.onload = function() {
                            self.onResourceLoaded(resource);
                        };
                        loader.onerror = function() {
                            self.onResourceLoaded(resource);
                        };
                        loader.src = resource.src;
                        if (resource.type === 'stylesheet') {
                            loader.href = resource.src;
                        }
                    }
                    break;
                    
                case 'video':
                    // 检查视频加载状态
                    if (resource.element.readyState >= 2) { // HAVE_METADATA
                        this.onResourceLoaded(resource);
                    } else {
                        resource.element.onloadstart = function() {
                            self.onResourceLoaded(resource);
                        };
                        resource.element.onerror = function() {
                            self.onResourceLoaded(resource);
                        };
                        // 设置超时，避免无限等待
                        setTimeout(() => {
                            self.onResourceLoaded(resource);
                        }, 3000);
                    }
                    break;
            }
        },
        
        onResourceLoaded: function(resource) {
            this.loadedResources++;
            
            const progress = Math.round((this.loadedResources / this.totalResources) * 100);
            
            let loadingText = this.getLoadingText(progress);
            this.updateProgress(progress, loadingText);
            
            console.log(`资源加载完成: ${resource.type} - ${progress}%`);
            
            if (this.loadedResources >= this.totalResources) {
                // 所有资源加载完成
                setTimeout(() => {
                    this.finalizeLoading();
                }, 300);
            }
        },
        
        getLoadingText: function(progress) {
            if (progress < 30) return '正在加载核心功能...';
            if (progress < 70) return '初始化视频播放器...';
            if (progress < 100) return '准备就绪...';
            return '完成！';
        },
        
        documentReadyCheck: function() {
            // 确保文档完全加载
            const checkReady = () => {
                if (document.readyState === 'complete') {
                    // 文档加载完成，但可能有异步资源
                    if (this.loadedResources >= this.totalResources || this.totalResources === 0) {
                        this.finalizeLoading();
                    }
                }
            };
            
            if (document.readyState === 'complete') {
                setTimeout(checkReady, 100);
            } else {
                document.addEventListener('readystatechange', checkReady);
                window.addEventListener('load', checkReady);
            }
        },
        
        simulateRealLoading: function() {
            // ⚡ 优化：减少强制等待时间
            const startTime = Date.now();
            const minLoadTime = 800; // 减少等待：0.8秒
            const maxLoadTime = 2000; // 最大2秒
            
            const checkLoading = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min((elapsed / maxLoadTime) * 100, 95);
                
                this.updateProgress(Math.round(progress), this.getLoadingText(progress));
                
                if (elapsed >= minLoadTime && document.readyState === 'complete') {
                    this.updateProgress(100, '完成！');
                    setTimeout(() => {
                        this.finalizeLoading();
                    }, 200); // 减少延迟
                } else if (elapsed < maxLoadTime) {
                    requestAnimationFrame(checkLoading);
                } else {
                    this.updateProgress(100, '完成！');
                    setTimeout(() => {
                        this.finalizeLoading();
                    }, 100);
                }
            };
            
            checkLoading();
        },
        
        finalizeLoading: function() {
            // 确保所有必要的初始化完成
            this.updateProgress(100, '准备就绪！');
            
            // 延迟一点时间确保所有异步操作完成
            setTimeout(() => {
                this.hide();
            }, 200);
        },
        
        updateProgress: function(percentage, text) {
            if (this.progressBar) {
                this.progressBar.style.width = percentage + '%';
            }
            if (this.progressText) {
                this.progressText.textContent = text || `${percentage}%`;
            }
        },
        
        hide: function() {
            console.log('隐藏预加载界面');
            if (this.element) {
                this.element.style.opacity = '0';
                setTimeout(() => {
                    this.element.style.display = 'none';
                    this.element.style.visibility = 'hidden';
                    document.body.classList.add('loaded');
                    
                    // 确保预加载界面完全移除
                    if (this.element.parentNode) {
                        this.element.parentNode.removeChild(this.element);
                    }
                }, 500);
            }
        }
    };
    
    // 立即开始真实的加载检测
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            preloader.init();
        });
    } else {
        preloader.init();
    }
    
    // 确保在window.load时隐藏预加载界面
    window.addEventListener('load', function() {
        setTimeout(() => {
            preloader.hide();
        }, 500);
    });
    
    // 暴露全局方法用于调试
    window.preloader = preloader;
})();