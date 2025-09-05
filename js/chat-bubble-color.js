                    // 聊天气泡颜色自定义下拉菜单的JavaScript代码
                    const bubbleColorButton = document.getElementById('bubbleColorButton');
                    const bubbleColorOptions = document.getElementById('bubbleColorOptions');
                    const bubbleColorValue = document.getElementById('bubbleColorValue');
                    const originalBubbleColorSelect = document.getElementById('bubbleColorSelect');
                    const bubbleColorOptionsList = document.querySelectorAll('.bubble-color-option');
                    
                    // 点击按钮显示/隐藏下拉菜单
                    bubbleColorButton.addEventListener('click', function(event) {
                      event.stopPropagation();
                      // 关闭其他下拉菜单，切换当前菜单状态
                      const wasVisible = bubbleColorOptions.style.display === 'block';
                      closeAllDropdowns();
                      bubbleColorOptions.style.display = wasVisible ? 'none' : 'block';
                    });
                    
                    // 点击选项选择值
                    bubbleColorOptionsList.forEach(option => {
                      option.addEventListener('click', function() {
                        // 更新显示的值
                        const value = this.getAttribute('data-value');
                        const text = this.textContent;
                        bubbleColorValue.textContent = text;
                        
                        // 更新原始select的值
                        originalBubbleColorSelect.value = value;
                        
                        // 触发原始select的change事件
                        const event = new Event('change');
                        originalBubbleColorSelect.dispatchEvent(event);
                        
                        // 隐藏下拉菜单
                        bubbleColorOptions.style.display = 'none';
                        
                        // 更新选中状态样式
                        bubbleColorOptionsList.forEach(opt => {
                          opt.style.backgroundColor = opt === this ? 'rgba(0,0,0,0.4)' : 'transparent';
                        });
                      });
                       
                      // 鼠标悬停样式
                      option.addEventListener('mouseover', function() {
                        this.style.backgroundColor = 'rgba(0,0,0,0.4)';
                      });
                       
                      option.addEventListener('mouseout', function() {
                        if (!this.classList.contains('selected')) {
                          this.style.backgroundColor = 'transparent';
                        }
                      });
                    });
                    
