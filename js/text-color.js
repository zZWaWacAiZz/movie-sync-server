                    // 文字颜色自定义下拉菜单的JavaScript代码
                    const fontColorButton = document.getElementById('fontColorButton');
                    const fontColorOptions = document.getElementById('fontColorOptions');
                    const fontColorValue = document.getElementById('fontColorValue');
                    const originalFontColorSelect = document.getElementById('fontColorSelect');
                    const colorOptions = document.querySelectorAll('.color-option');
                    
                    // 点击按钮显示/隐藏下拉菜单
                    fontColorButton.addEventListener('click', function(event) {
                      event.stopPropagation();
                      // 关闭其他下拉菜单，切换当前菜单状态
                      const wasVisible = fontColorOptions.style.display === 'block';
                      closeAllDropdowns();
                      fontColorOptions.style.display = wasVisible ? 'none' : 'block';
                    });
                    
                    // 点击选项选择值
                    colorOptions.forEach(option => {
                      option.addEventListener('click', function() {
                        // 更新显示的值
                        const value = this.getAttribute('data-value');
                        const text = this.textContent;
                        fontColorValue.textContent = text;
                        
                        // 更新原始select的值
                        originalFontColorSelect.value = value;
                        
                        // 触发原始select的change事件
                        const event = new Event('change');
                        originalFontColorSelect.dispatchEvent(event);
                        
                        // 隐藏下拉菜单
                        fontColorOptions.style.display = 'none';
                        
                        // 更新选中状态样式
                        colorOptions.forEach(opt => {
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
                    
