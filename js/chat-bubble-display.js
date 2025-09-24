                    // 聊天气泡显示自定义下拉菜单的JavaScript代码
                    const bubbleDisplayButton = document.getElementById('bubbleDisplayButton');
                    const bubbleDisplayOptions = document.getElementById('bubbleDisplayOptions');
                    const bubbleDisplayValue = document.getElementById('bubbleDisplayValue');
                    const originalBubbleDisplaySelect = document.getElementById('bubbleDisplaySelect');
                    const bubbleDisplayOptionsList = document.querySelectorAll('.bubble-display-option');
                    
                    // 点击按钮显示/隐藏下拉菜单
                    bubbleDisplayButton.addEventListener('click', function(event) {
                      event.stopPropagation();
                      // 关闭其他下拉菜单，切换当前菜单状态
                      const wasVisible = bubbleDisplayOptions.style.display === 'block';
                      closeAllDropdowns();
                      bubbleDisplayOptions.style.display = wasVisible ? 'none' : 'block';
                    });
                    
                    // 点击选项选择值
                    bubbleDisplayOptionsList.forEach(option => {
                      option.addEventListener('click', function() {
                        // 更新显示的值
                        const value = this.getAttribute('data-value');
                        const text = this.textContent;
                        bubbleDisplayValue.textContent = text;
                        
                        // 更新原始select的值
                        originalBubbleDisplaySelect.value = value;
                        
                        // 触发原始select的change事件
                        const event = new Event('change');
                        originalBubbleDisplaySelect.dispatchEvent(event);
                        
                        // 隐藏下拉菜单
                        bubbleDisplayOptions.style.display = 'none';
                        
                        // 更新选中状态样式
                        bubbleDisplayOptionsList.forEach(opt => {
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

