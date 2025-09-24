
                    // 文字大小自定义下拉菜单的JavaScript代码
                    const fontSizeButton = document.getElementById('fontSizeButton');
                    const fontSizeOptions = document.getElementById('fontSizeOptions');
                    const fontSizeValue = document.getElementById('fontSizeValue');
                    const originalFontSizeSelect = document.getElementById('fontSizeSelect');
                    const customOptions = document.querySelectorAll('.custom-option');
                    
                    // 点击按钮显示/隐藏下拉菜单
                     fontSizeButton.addEventListener('click', function(event) {
                       event.stopPropagation();
                       // 关闭其他下拉菜单，切换当前菜单状态
                       const wasVisible = fontSizeOptions.style.display === 'block';
                       closeAllDropdowns();
                       fontSizeOptions.style.display = wasVisible ? 'none' : 'block';
                     });
                    
                    // 点击选项选择值
                    customOptions.forEach(option => {
                      option.addEventListener('click', function() {
                        // 更新显示的值
                        const value = this.getAttribute('data-value');
                        const text = this.textContent;
                        fontSizeValue.textContent = text;
                        
                        // 更新原始select的值
                        originalFontSizeSelect.value = value;
                        
                        // 触发原始select的change事件
                        const event = new Event('change');
                        originalFontSizeSelect.dispatchEvent(event);
                        
                        // 隐藏下拉菜单
                        fontSizeOptions.style.display = 'none';
                        
                        // 更新选中状态样式
                        customOptions.forEach(opt => {
                          opt.style.backgroundColor = opt === this ? 'var(--popup-hover-bg)' : 'transparent';
                        });
                      });
                       
                      // 鼠标悬停样式
                      option.addEventListener('mouseover', function() {
                        this.style.backgroundColor = 'var(--popup-hover-bg)';
                      });
                       
                      option.addEventListener('mouseout', function() {
                        if (!this.classList.contains('selected')) {
                          this.style.backgroundColor = 'transparent';
                        }
                      });
                    });
                    

