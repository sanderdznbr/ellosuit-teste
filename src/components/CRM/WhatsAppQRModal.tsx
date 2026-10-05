import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Loader2, CheckCircle2, RefreshCw, Smartphone, AlertCircle, Clock, Shield, MessageCircle, Link2, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import WhatsAppSyncScreen from './WhatsAppSyncScreen';

const EllosuitLogo = () => (
  <svg width="40" height="40" viewBox="0 0 651 672" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M373.638 48C378.469 48 384.396 48.1315 386.825 48.3156C389.253 48.4997 393.196 48.9206 395.625 49.2099C398.027 49.5256 402.623 50.2357 405.834 50.8407C409.02 51.4193 414.164 52.4977 417.272 53.2605C420.353 54.0233 425.575 55.4699 428.866 56.4694C432.156 57.4689 437.692 59.389 441.191 60.7042C444.664 62.0456 449.494 63.992 451.923 65.0704C454.351 66.1488 457.981 67.8059 460.018 68.7791C462.054 69.726 466.154 71.8565 469.157 73.4609C472.16 75.0917 476.991 77.8535 479.889 79.6158C482.788 81.3517 487.775 84.5606 490.987 86.6912C494.173 88.848 498.69 92.0306 501.014 93.8192C503.338 95.5814 506.733 98.2117 508.561 99.6847C510.415 101.158 514.123 104.261 516.838 106.602C519.554 108.943 525.064 114.125 529.111 118.123C533.159 122.121 538.433 127.644 540.862 130.38C543.29 133.089 547.207 137.718 549.557 140.638C551.933 143.584 555.328 147.95 557.13 150.396C558.905 152.842 562.326 157.787 564.702 161.391C567.078 164.994 570.395 170.333 572.092 173.253C573.789 176.173 576.818 181.749 578.803 185.668C580.787 189.561 583.399 194.979 584.6 197.715C585.801 200.45 587.498 204.501 588.36 206.763C589.222 208.998 590.762 213.286 591.781 216.31C592.799 219.335 594.288 224.122 595.071 226.963C595.88 229.777 597.082 234.565 597.761 237.589C598.413 240.614 599.301 245.086 599.719 247.505C600.111 249.952 600.763 254.581 601.155 257.79C601.677 261.998 601.939 266.785 602.069 274.808C602.2 283.461 602.121 287.485 601.677 292.693C601.364 296.402 600.711 302.057 600.215 305.292C599.719 308.501 598.674 314.077 597.891 317.681C597.108 321.284 595.828 326.492 595.071 329.201C594.314 331.937 592.956 336.329 592.094 338.96C591.206 341.59 589.326 346.693 587.916 350.296C586.506 353.9 584.078 359.555 582.511 362.869C580.97 366.183 578.516 371.128 577.08 373.863C575.643 376.599 573.319 380.833 571.909 383.253C570.499 385.699 567.261 390.881 564.702 394.774C562.143 398.693 558.148 404.427 555.824 407.531C553.5 410.661 549.818 415.369 547.625 417.999C545.431 420.629 541.645 425.022 539.164 427.757C536.71 430.466 531.775 435.569 528.223 439.094C524.672 442.592 519.058 447.8 515.794 450.641C512.504 453.455 508.378 456.901 506.628 458.295C504.905 459.662 501.406 462.293 498.899 464.134C496.392 466.001 492.423 468.789 490.099 470.341C487.775 471.919 484.224 474.234 482.187 475.497C480.15 476.759 475.868 479.284 472.682 481.099C469.496 482.914 464.013 485.781 460.54 487.491C457.067 489.2 452.628 491.252 450.696 492.067C448.763 492.883 444.794 494.461 441.896 495.618C438.997 496.749 433.592 498.617 429.936 499.8C426.254 500.958 421.476 502.378 415.418 503.956L414.634 507.507C414.19 509.453 413.303 512.951 412.624 515.292C411.945 517.633 410.535 521.868 409.464 524.682C408.393 527.523 406.174 532.626 404.529 536.019C402.884 539.438 400.429 544.146 399.071 546.487C397.687 548.828 395.442 552.405 394.084 554.457C392.726 556.509 390.428 559.77 388.966 561.717C387.504 563.663 384.736 567.188 382.803 569.528C380.871 571.869 376.589 576.499 373.298 579.813C369.982 583.127 365.7 587.151 363.767 588.782C361.835 590.413 358.44 593.122 356.221 594.858C353.975 596.567 350.111 599.303 347.578 600.96C345.071 602.617 341.18 605.011 338.961 606.299C336.741 607.562 333.425 609.351 331.571 610.297C329.743 611.218 326.818 612.586 325.069 613.375C323.319 614.138 320.238 615.4 318.201 616.163C316.164 616.952 312.143 618.293 309.245 619.135C306.32 619.977 302.064 621.082 299.74 621.581C297.416 622.081 293.682 622.765 291.462 623.107C288.094 623.633 285.274 623.738 274.75 623.712C263.104 623.685 261.511 623.607 255.035 622.739C251.171 622.213 244.512 621.082 240.256 620.214C235.999 619.346 230.307 618.004 227.591 617.241C224.876 616.452 220.071 614.953 216.859 613.901C213.673 612.823 208.764 611.06 205.944 609.929C203.15 608.798 198.868 607.01 196.465 605.931C194.037 604.879 189.989 602.959 187.483 601.696C184.976 600.408 180.38 597.935 177.273 596.173C174.191 594.437 169.987 591.938 167.951 590.676C165.914 589.413 162.362 587.099 160.038 585.547C157.714 583.969 153.745 581.18 151.239 579.339C148.732 577.498 145.233 574.842 143.509 573.474C141.76 572.106 137.634 568.66 134.344 565.82C131.054 562.979 125.387 557.719 121.732 554.115C118.076 550.485 113.219 545.462 110.947 542.936C108.649 540.411 104.915 536.098 102.67 533.362C100.398 530.627 96.7159 525.945 94.4441 522.92C92.1985 519.895 88.595 514.793 86.4537 511.557C84.3125 508.349 81.1268 503.325 79.3773 500.405C77.6539 497.486 74.9643 492.698 73.3975 489.779C71.8569 486.859 69.2718 481.651 67.6789 478.258C66.0861 474.839 63.6315 469.105 62.2214 465.502C60.7853 461.898 58.8268 456.532 57.8607 453.613C56.9206 450.693 55.4844 445.985 54.7272 443.171C53.9438 440.33 52.7688 435.385 52.0637 432.176C51.3848 428.967 50.4186 423.707 49.9225 420.471C49.4525 417.263 48.7736 411.686 48.4602 408.083C48.0163 402.954 47.9118 399.009 48.0685 390.171C48.173 383.095 48.4602 377.02 48.7997 374.047C49.113 371.417 49.7658 366.84 50.262 363.868C50.732 360.896 51.6198 356.267 52.1943 353.584C52.7949 350.901 53.6827 347.192 54.1788 345.325C54.675 343.484 55.615 340.143 56.2939 337.881C56.9467 335.645 58.4613 331.095 59.6363 327.781C60.8114 324.467 62.822 319.285 64.0754 316.26C65.3549 313.262 68.1751 307.186 70.3424 302.794C72.5358 298.427 75.8521 292.194 77.7061 288.985C79.5862 285.776 83.0591 280.173 85.4354 276.57C87.7855 272.966 91.2062 268.021 93.008 265.575C94.8097 263.155 98.2043 258.763 100.581 255.843C102.931 252.924 106.404 248.768 108.284 246.637C110.164 244.481 114.76 239.641 118.468 235.88C122.175 232.092 127.816 226.7 131.001 223.859C134.187 221.019 138.626 217.231 140.872 215.443C143.092 213.654 146.799 210.761 149.123 208.998C151.447 207.236 155.965 204.027 159.151 201.87C162.362 199.74 167.35 196.557 170.248 194.795C173.147 193.033 178.056 190.245 181.137 188.561C184.245 186.904 189.154 184.432 192.052 183.064C194.951 181.723 198.841 179.96 200.669 179.171C202.523 178.408 206.78 176.725 210.174 175.436C213.569 174.174 219.261 172.254 222.839 171.201C226.416 170.123 230.594 168.966 232.083 168.598C233.989 168.15 234.824 167.782 234.824 167.414C234.798 167.125 235.373 164.573 236.052 161.733C236.757 158.918 238.036 154.447 238.898 151.816C239.786 149.186 241.274 145.162 242.214 142.874C243.18 140.559 245.243 136.114 246.81 132.931C248.403 129.775 250.622 125.593 251.797 123.646C252.972 121.674 255.296 118.018 257.02 115.493C258.717 112.941 261.485 109.127 263.182 106.97C264.854 104.84 267.778 101.315 269.658 99.1849C271.565 97.0281 275.377 93.0301 278.145 90.3209C280.913 87.5854 284.542 84.2187 286.187 82.8247C287.833 81.4569 290.757 79.0634 292.689 77.5378C294.622 76.0123 298.669 73.1453 301.672 71.1463C304.675 69.1473 309.192 66.3592 311.699 64.9652C314.206 63.5449 318.567 61.3091 321.361 59.994C324.181 58.6789 328.62 56.8114 331.231 55.8382C333.843 54.865 337.316 53.6551 338.961 53.1553C340.606 52.6293 343.948 51.7613 346.35 51.1826C348.779 50.604 352.095 49.8938 353.74 49.5782C355.385 49.2625 358.545 48.7891 360.791 48.5261C363.062 48.2367 368.703 48.0263 373.638 48ZM361.835 105.708C359.798 106.129 356.012 107.207 353.401 108.075C350.79 108.969 346.272 110.863 343.374 112.284C340.475 113.73 335.958 116.334 333.346 118.07C330.735 119.78 326.923 122.542 324.886 124.172C322.849 125.803 318.959 129.38 316.243 132.116C313.527 134.851 309.976 138.77 308.357 140.822C306.738 142.874 304.048 146.609 302.403 149.16C300.732 151.685 298.251 156.077 296.841 158.892C295.431 161.733 294.361 164.126 294.413 164.205C294.491 164.31 295.248 164.521 296.084 164.678C296.92 164.836 300.079 165.52 303.082 166.204C306.085 166.914 310.838 168.256 313.632 169.176C316.426 170.123 320.473 171.596 322.614 172.49C324.729 173.358 328.228 174.936 330.344 175.936C332.485 176.962 336.193 178.908 338.621 180.25C341.023 181.617 345.463 184.353 348.466 186.352C351.468 188.351 355.516 191.218 357.448 192.743C359.381 194.269 362.305 196.636 363.95 198.03C365.595 199.424 369.199 202.791 371.993 205.5C374.761 208.236 378.599 212.234 380.479 214.364C382.359 216.521 385.153 219.861 386.694 221.808C388.209 223.754 390.585 226.963 391.943 228.909C393.274 230.856 395.624 234.433 397.139 236.879C398.654 239.325 401.369 244.27 403.171 247.874C404.973 251.477 407.166 256.185 408.028 258.316C408.916 260.473 410.274 264.129 411.057 266.47C411.84 268.811 413.12 273.203 413.877 276.228C414.634 279.253 415.601 283.698 415.992 286.144C416.384 288.59 416.88 292.246 417.089 294.298C417.324 296.718 417.428 323.467 417.428 371.128C417.428 440.593 417.454 444.223 418.055 444.012C418.395 443.907 420.17 443.25 421.998 442.539C423.852 441.855 427.899 440.146 430.981 438.752C434.088 437.384 439.232 434.833 442.418 433.097C445.604 431.361 449.886 428.888 451.923 427.626C453.96 426.363 457.276 424.206 459.313 422.839C461.349 421.471 465.057 418.814 467.59 416.921C470.097 415.027 473.883 412.002 476.025 410.213C478.14 408.425 482.422 404.611 485.477 401.744C488.559 398.903 493.415 394.011 496.288 390.881C499.134 387.751 502.868 383.543 504.565 381.491C506.237 379.439 508.978 375.941 510.676 373.679C512.347 371.443 514.775 368.05 516.055 366.157C517.361 364.263 519.476 361.001 520.755 358.897C522.035 356.793 524.15 353.163 525.455 350.822C526.761 348.481 528.615 344.983 529.581 343.037C530.573 341.09 532.192 337.566 533.185 335.225C534.203 332.884 535.665 329.307 536.449 327.255C537.232 325.203 538.329 322.179 538.877 320.521C539.452 318.864 540.522 315.208 541.279 312.368C542.037 309.553 543.055 305.24 543.551 302.794C544.021 300.374 544.674 296.297 545.014 293.772C545.327 291.22 545.692 286.644 545.823 283.566C545.954 280.515 545.954 275.491 545.823 272.414C545.692 269.337 545.327 264.76 544.987 262.209C544.674 259.684 543.969 255.37 543.421 252.661C542.872 249.925 541.984 246.164 541.488 244.323C540.966 242.482 540 239.194 539.321 237.063C538.668 234.906 537.415 231.329 536.553 229.067C535.718 226.832 534.307 223.412 533.446 221.466C532.584 219.519 530.808 215.758 529.503 213.128C528.197 210.498 526.343 206.92 525.351 205.158C524.385 203.396 522.714 200.529 521.669 198.767C520.598 197.031 518.457 193.664 516.89 191.323C515.35 188.982 512.712 185.247 511.041 183.011C509.344 180.749 506.654 177.33 505.062 175.384C503.443 173.437 500.936 170.491 499.447 168.834C497.985 167.203 494.956 163.942 492.737 161.601C490.517 159.286 486.391 155.288 483.597 152.737C480.777 150.159 476.834 146.714 474.797 145.03C472.761 143.373 469.288 140.638 467.042 138.981C464.822 137.324 461.506 134.956 459.652 133.72C457.824 132.484 453.855 129.985 450.852 128.17C447.875 126.329 442.81 123.515 439.598 121.884C436.412 120.253 431.66 118.018 429.048 116.887C426.437 115.756 421.92 113.993 419.021 112.915C416.123 111.863 411.527 110.364 408.811 109.627C406.096 108.864 402.414 107.917 400.638 107.523C398.836 107.128 395.442 106.497 393.066 106.102C390.689 105.734 386.616 105.235 384.004 105.05C381.393 104.84 377.92 104.63 376.275 104.577C374.63 104.524 371.523 104.603 369.408 104.735C367.266 104.866 363.872 105.313 361.835 105.708ZM289.608 376.362C290.026 378.492 290.783 381.675 291.279 383.437C291.802 385.2 292.768 388.067 293.473 389.829C294.152 391.565 295.614 394.853 296.711 397.088C297.807 399.324 299.479 402.428 300.445 404.006C301.385 405.558 303.108 408.188 304.257 409.845C305.432 411.502 307.26 413.975 308.357 415.342C309.454 416.71 311.751 419.34 313.449 421.182C315.146 423.049 317.966 425.89 319.742 427.521C321.518 429.178 324.233 431.519 325.774 432.781C327.314 434.044 330.735 436.516 333.346 438.252C335.958 440.014 339.901 442.382 342.146 443.513C344.366 444.644 347.917 446.301 350.058 447.169C352.173 448.063 355.385 449.194 357.187 449.694C358.963 450.193 360.66 450.614 360.947 450.614C361.417 450.614 361.469 442.013 361.365 374.836C361.261 299.295 361.261 299.059 360.529 295.192C360.112 293.035 359.224 289.458 358.545 287.196C357.866 284.96 356.586 281.383 355.699 279.226C354.785 277.096 353.218 273.729 352.173 271.783C351.129 269.836 349.04 266.338 347.499 263.997C345.985 261.656 343.4 258.053 341.781 256.027C340.136 253.976 336.584 250.057 333.869 247.321C331.153 244.586 327.288 241.009 325.252 239.378C323.215 237.721 319.402 234.985 316.791 233.249C314.18 231.513 309.819 229.015 307.13 227.647C304.414 226.305 300.445 224.57 298.33 223.807C296.189 223.044 293.421 222.15 292.167 221.834C290.914 221.518 289.608 221.15 289.295 221.071C288.72 220.887 288.694 225.622 288.773 296.665C288.877 372.417 288.877 372.443 289.608 376.362ZM218.791 233.065C217.251 233.749 213.934 235.327 211.402 236.616C208.895 237.879 204.691 240.141 202.079 241.666C199.468 243.165 195.029 245.927 192.235 247.768C189.415 249.636 185.315 252.503 183.096 254.16C180.85 255.817 177.377 258.553 175.34 260.236C173.304 261.919 169.596 265.128 167.063 267.39C164.556 269.679 160.43 273.65 157.923 276.28C155.417 278.884 152.153 282.356 150.69 284.013C149.202 285.671 146.695 288.616 145.076 290.563C143.483 292.536 140.794 295.955 139.096 298.191C137.425 300.426 134.736 304.266 133.117 306.713C131.498 309.132 128.939 313.209 127.398 315.734C125.883 318.286 123.168 323.31 121.34 326.913C119.538 330.516 117.397 334.988 116.587 336.829C115.778 338.67 114.368 342.195 113.454 344.641C112.514 347.061 111.208 350.901 110.503 353.137C109.824 355.372 108.91 358.45 108.519 359.949C108.101 361.475 107.396 364.499 106.926 366.683C106.456 368.892 105.725 373.153 105.307 376.178C104.889 379.203 104.445 384.253 104.315 387.435C104.184 390.592 104.184 395.773 104.315 398.956C104.445 402.112 104.889 407.189 105.307 410.187C105.725 413.212 106.508 417.762 107.056 420.314C107.631 422.839 108.649 426.994 109.354 429.52C110.059 432.045 111.496 436.437 112.514 439.252C113.532 442.092 115.36 446.721 116.561 449.536C117.789 452.377 119.564 456.269 120.53 458.216C121.523 460.188 123.403 463.766 124.761 466.212C126.118 468.632 128.103 472.077 129.174 473.813C130.244 475.575 132.333 478.758 133.769 480.915C135.232 483.045 137.791 486.649 139.462 488.885C141.133 491.12 143.901 494.645 145.572 496.696C147.27 498.722 150.925 502.878 153.667 505.902C156.435 508.927 161.292 513.819 164.478 516.765C167.637 519.738 171.972 523.63 174.113 525.419C176.228 527.207 180.041 530.206 182.547 532.1C185.08 533.994 188.788 536.676 190.825 538.044C192.862 539.412 195.865 541.358 197.51 542.384C199.155 543.436 202.393 545.33 204.717 546.645C207.041 547.96 210.462 549.801 212.289 550.722C214.117 551.669 217.616 553.3 220.045 554.352C222.447 555.43 226.416 557.061 228.819 557.982C231.247 558.928 235.059 560.244 237.279 560.927C239.498 561.638 242.501 562.506 243.964 562.9C245.4 563.295 248.116 563.952 249.943 564.373C251.771 564.768 254.8 565.346 256.628 565.636C258.456 565.951 262.19 566.425 264.906 566.714C267.595 567.003 272.426 567.24 275.638 567.24C278.824 567.24 282.61 567.082 284.072 566.846C285.535 566.635 288.616 565.978 290.94 565.399C293.264 564.82 296.972 563.61 299.218 562.716C301.437 561.848 305.223 560.112 307.652 558.876C310.08 557.64 313.945 555.351 316.269 553.826C318.593 552.274 321.909 549.907 323.659 548.539C325.408 547.171 328.333 544.646 330.161 542.936C332.015 541.227 335.07 538.123 336.976 536.071C338.856 533.994 341.572 530.785 342.982 528.943C344.392 527.076 346.612 523.972 347.891 522.026C349.197 520.08 351.416 516.134 352.879 513.241C354.315 510.374 355.516 507.901 355.516 507.77C355.516 507.612 353.401 507.033 350.842 506.481C348.283 505.929 343.818 504.798 340.893 503.93C337.994 503.088 333.895 501.72 331.754 500.931C329.612 500.116 325.434 498.301 322.431 496.907C319.429 495.513 314.754 493.119 312.039 491.594C309.349 490.068 305.067 487.464 302.56 485.781C300.027 484.124 296.162 481.362 293.917 479.652C291.697 477.943 288.303 475.207 286.37 473.576C284.438 471.972 280.156 467.921 276.839 464.607C273.549 461.293 269.267 456.664 267.334 454.323C265.402 451.982 262.634 448.484 261.172 446.537C259.709 444.591 257.412 441.303 256.054 439.252C254.696 437.226 252.502 433.702 251.171 431.466C249.865 429.23 247.489 424.759 245.922 421.55C244.355 418.315 242.371 413.948 241.535 411.792C240.7 409.661 239.394 405.979 238.611 403.638C237.853 401.297 236.704 397.246 236.052 394.616C235.399 391.959 234.563 387.83 234.145 385.384C233.754 382.964 233.258 379.282 233.049 377.23C232.814 374.81 232.683 348.113 232.709 300.584C232.709 242.482 232.605 227.673 232.265 227.673C232.03 227.7 229.524 228.62 226.73 229.751C223.909 230.882 220.358 232.381 218.791 233.065Z" fill="#374DA4"/>
  </svg>
);

interface WhatsAppQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  userId: string;
  onSuccess: (session: any) => void;
  existingSession?: any;
}

const QR_TIMEOUT_MS = 180000; // 3 minutos (WhatsApp nativo)
const POLL_INTERVAL_MS = 4000; // 4 segundos para evitar rate limit na Railway

const WhatsAppQRModal: React.FC<WhatsAppQRModalProps> = ({
  isOpen,
  onClose,
  companyId,
  userId,
  onSuccess,
  existingSession
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'loading' | 'qr' | 'connected' | 'syncing' | 'timeout'>('loading');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('disconnected');
  const [loading, setLoading] = useState(false);
  const [phoneInfo, setPhoneInfo] = useState<{ phoneNumber?: string; pushName?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [connectedSession, setConnectedSession] = useState<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pollInFlightRef = useRef(false);
  const initedForRef = useRef<string | null>(null);
  const regenInFlightRef = useRef(false);
  const lastRegenAtRef = useRef(0);
  const qrCodeRef = useRef<string | null>(null);

  useEffect(() => { qrCodeRef.current = qrCode; }, [qrCode]);

  // Auto-create instance or use existing when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const key = existingSession?.id ? `existing:${existingSession.id}` : 'new';
    if (initedForRef.current === key) return; // evita loop de regeneração
    initedForRef.current = key;

    if (existingSession?.id) {
      setSessionId(existingSession.id);
      setStep('loading');
      startTimeRef.current = Date.now();
      // Não recria a sessão de cara: só busca o QR/status atual.
      // A recriação só acontece se nada vier (fallback abaixo) ou no botão manual.
    } else {
      startTimeRef.current = Date.now();
      createInstance();
    }
  }, [isOpen, existingSession?.id]);

  // Clean up on close
  useEffect(() => {
    if (!isOpen) {
      setStep('loading');
      initedForRef.current = null;
      regenInFlightRef.current = false;
      setSessionId(null);
      setQrCode(null);
      setStatus('disconnected');
      setPhoneInfo(null);
      setError(null);
      setPollCount(0);
      setElapsedTime(0);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [isOpen]);

  // Timer for elapsed time
  useEffect(() => {
    if (step === 'qr' && !qrCode) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, qrCode]);

  // Timeout handler
  useEffect(() => {
    if (step === 'qr') {
      timeoutRef.current = setTimeout(() => {
        if (!qrCode && step === 'qr') {
          setStep('timeout');
          toast({
            title: 'Tempo esgotado',
            description: 'Não foi possível gerar o QR Code. Tente novamente.',
            variant: 'destructive'
          });
        }
      }, QR_TIMEOUT_MS);
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [step, qrCode]);

  // Poll for QR and status
  useEffect(() => {
    if ((step !== 'qr' && step !== 'loading') || !sessionId) return;

    let isMounted = true;
    let consecutiveErrors = 0;
    let emptyPolls = 0;

    const pollQRAndStatus = async () => {
      if (!isMounted || pollInFlightRef.current) return;
      
      // If we are in syncing step, stop polling to avoid race conditions with webhook
      // Use type assertion since TS doesn't see the full union in this effect scope
      if ((step as string) === 'syncing' || (step as string) === 'connected') return;

      pollInFlightRef.current = true;
      setPollCount(prev => prev + 1);
      
      try {
        // Se já temos um QR, apenas checamos o status para não resetar a instância no Evolution
        const action = qrCodeRef.current ? 'check_status' : 'get_qr_code';
        const { data: qrData, error: qrError } = await supabase.functions.invoke('whatsapp-api', {
          body: { action, sessionId }
        });

       if (qrError && isMounted) {
         consecutiveErrors++;
         if (consecutiveErrors < 4) return; // tolera falhas transitórias da edge function
         const details = typeof qrError.context?.json === 'function'
           ? await qrError.context.json().catch(() => null)
           : null;
         setError(details?.details || details?.error || qrError.message || 'Falha ao gerar QR Code');
         setStep('timeout');
         return;
       }

       if (qrData?.status === 'error' && isMounted) {
         consecutiveErrors++;
         if (consecutiveErrors < 4) return;
         setError(qrData.details || qrData.error || 'Falha ao gerar QR Code');
         setStep('timeout');
         return;
       }

       if (qrData && isMounted) {
          consecutiveErrors = 0;
          if (qrData.status) setStatus(qrData.status);

          if (qrData.status === 'connected' || qrData.isConnected) {
            const { data: sessionData } = await supabase
              .from('whatsapp_sessions')
              .select('*')
              .eq('id', sessionId)
              .maybeSingle();

            if (sessionData) {
              setConnectedSession(sessionData);
              setQrCode(null);
              setStep('syncing');
            }
            return;
          }

         if (qrData.qrCode) {
           // Evolution retorna base64, garantimos o prefixo data:image
           const formattedQR = qrData.qrCode.startsWith('data:') ? qrData.qrCode : `data:image/png;base64,${qrData.qrCode}`;
           setQrCode(formattedQR);
           setStep('qr');
           emptyPolls = 0;
         } else if (!qrCodeRef.current) {
           emptyPolls++;
           if (emptyPolls === 6) {
             // Fallback silencioso: recria a instância só se o QR nunca veio
             regenerateQRCode(sessionId, true);
           }
         }
         
       }
      } catch (e) {
        console.error('Polling error:', e);
      } finally {
        pollInFlightRef.current = false;
      }
    };

    pollQRAndStatus();
    const interval = setInterval(pollQRAndStatus, POLL_INTERVAL_MS);
    
    return () => {
      isMounted = false;
      pollInFlightRef.current = false;
      clearInterval(interval);
    };
  }, [step, sessionId]);

  const createInstance = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Generate unique instance name
      const instanceName = `whatsapp-${Date.now()}`;
      
      console.log('[QR Modal] Creating instance:', instanceName);
      
       const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
           action: 'create_instance',
          instanceName,
          companyId,
          userId
          // Server URL comes from BAILEYS_SERVER_URL secret in edge function
        }
      });

       if (error) {
         const details = typeof error.context?.json === 'function'
           ? await error.context.json().catch(() => null)
           : null;
         throw new Error(details?.details || details?.error || error.message);
       }

      if (!data?.session?.id) {
        throw new Error('Sessão não criada corretamente');
      }

       setSessionId(data.session.id);
      console.log('[QR Modal] Session created:', data.session.id);

       if (data.qrCode) {
         setQrCode(data.qrCode);
         setStep('qr');
         return;
       }
      
      // Get initial QR code
      const qrResponse = await supabase.functions.invoke('whatsapp-api', {
        body: { 
          action: 'get_qr_code', 
          sessionId: data.session.id 
        }
      });

      if (qrResponse.data?.qrCode) {
        setQrCode(qrResponse.data.qrCode);
      }
      
      setStep('qr');
      
      toast({
        title: 'Aguardando conexão',
        description: 'Escaneie o QR Code com seu WhatsApp'
      });
    } catch (e: any) {
      console.error('Error creating instance:', e);
      setError(e.message || 'Erro ao criar instância');
      toast({ 
        title: 'Erro', 
        description: e.message || 'Erro ao criar instância', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshQRCode = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
       const { data, error } = await supabase.functions.invoke('whatsapp-api', {
         body: { action: 'get_qr_code', sessionId }
      });

      if (!error && data?.qrCode) {
        setQrCode(data.qrCode);
        toast({ title: 'QR Code atualizado' });
      }
    } catch (e) {
      console.error('Error refreshing QR:', e);
    } finally {
      setLoading(false);
    }
  };

  // Força regeneração do QR Code deletando e recriando instância no servidor
  const regenerateQRCode = async (forcedSessionId?: string, silent = false) => {
    const sid = forcedSessionId || sessionId;
    if (!sid) return;
    if (regenInFlightRef.current) return;
    if (Date.now() - lastRegenAtRef.current < 15000) return; // cooldown anti-flood
    regenInFlightRef.current = true;
    lastRegenAtRef.current = Date.now();

    setLoading(true);
    setQrCode(null);
    setPollCount(0);
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    
    try {
      if (!silent) {
        toast({ title: 'Regenerando QR Code...', description: 'Recriando sessão no servidor' });
      }
      
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'force_reconnect', sessionId: sid }
      });

      if (error) throw error;

      console.log('[QR Modal] Regenerate response:', data);
      
      if (data?.qrCode && data.qrCode.startsWith('data:image')) {
        setQrCode(data.qrCode);
        toast({ title: 'QR Code gerado!', description: 'Escaneie com seu WhatsApp' });
      } else {
        toast({ title: 'Aguarde...', description: 'O QR Code será gerado em instantes' });
      }
    } catch (e: any) {
      console.error('Error regenerating QR:', e);
      toast({ 
        title: 'Erro', 
        description: e.message || 'Erro ao regenerar QR Code', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
      regenInFlightRef.current = false;
    }
  };

  // Migrate conversations from old sessions with the same phone number to the new session
  const migrateConversationsToNewSession = async (newSession: any) => {
    if (!newSession?.phone_number || !newSession?.id) return;
    
    const phoneNumber = newSession.phone_number.replace(/\D/g, '');
    if (!phoneNumber) return;
    
    try {
      // Find all other sessions with the same phone number
      const { data: otherSessions } = await supabase
        .from('whatsapp_sessions')
        .select('id, phone_number')
        .eq('company_id', companyId)
        .neq('id', newSession.id);
      
      if (!otherSessions || otherSessions.length === 0) return;
      
      const matchingSessions = otherSessions.filter(s => 
        s.phone_number?.replace(/\D/g, '') === phoneNumber
      );
      
      if (matchingSessions.length === 0) return;
      
      const oldSessionIds = matchingSessions.map(s => s.id);
      console.log(`[Session Migration] Found ${matchingSessions.length} old session(s) with same phone. Migrating conversations...`);
      
      // Migrate conversations from old sessions to new session
      const { data: migratedConvs, error: migrateError } = await supabase
        .from('whatsapp_conversations')
        .update({ session_id: newSession.id })
        .in('session_id', oldSessionIds)
        .select('id');
      
      if (migrateError) {
        console.error('[Session Migration] Error migrating conversations:', migrateError);
      } else {
        const count = migratedConvs?.length || 0;
        if (count > 0) {
          console.log(`[Session Migration] ✅ Migrated ${count} conversations to new session`);
          toast({
            title: 'Histórico recuperado!',
            description: `${count} conversa(s) migrada(s) da sessão anterior.`,
          });
        }
      }
      
      // Also migrate messages from old sessions
      await supabase
        .from('whatsapp_messages')
        .update({ session_id: newSession.id })
        .in('session_id', oldSessionIds);
      
      // Delete old sessions (cleanup)
      await supabase
        .from('whatsapp_sessions')
        .delete()
        .in('id', oldSessionIds);
      
      console.log(`[Session Migration] Deleted ${oldSessionIds.length} old session(s)`);
    } catch (e) {
      console.error('[Session Migration] Error:', e);
    }
  };

  const handleSyncComplete = async () => {
    // Migrate conversations from old sessions with same phone number
    if (connectedSession) {
      await migrateConversationsToNewSession(connectedSession);
      onSuccess(connectedSession);
    }
    onClose();
  };

  // Show sync screen as a full overlay
  if (step === 'syncing' && sessionId) {
    return (
      <WhatsAppSyncScreen 
        sessionId={sessionId} 
        onComplete={handleSyncComplete} 
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>Escaneie o QR Code com seu WhatsApp</DialogDescription>
        </DialogHeader>

        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            {error ? (
              <div className="text-center">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={createInstance} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Conectando ao servidor...</p>
              </>
            )}
          </div>
        )}

        {step === 'timeout' && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Tempo Esgotado</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center px-4">
              Não foi possível gerar o QR Code em 2 minutos.<br />
              Verifique se o servidor Baileys está funcionando.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={() => {
                setStep('loading');
                setSessionId(null);
                setQrCode(null);
                setPollCount(0);
                setElapsedTime(0);
                startTimeRef.current = Date.now();
                createInstance();
              }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          </div>
        )}

         {step === 'qr' && (
           <div className="flex flex-col md:flex-row min-h-[460px]">
             {/* Left side - QR Code */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-950">

                <div className="relative">
                  {qrCode && qrCode.startsWith('data:image') ? (
                    <div className="relative z-10">
                       <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <img 
                          src={qrCode} 
                          alt="QR Code WhatsApp" 
                          className="w-64 h-64 md:w-72 md:h-72"
                        />
                       </div>
                    </div>
                  ) : (
                    <div className="relative z-10 w-64 h-64 md:w-72 md:h-72 bg-zinc-50 dark:bg-zinc-900 rounded-2xl flex flex-col items-center justify-center gap-4 border border-zinc-200 dark:border-zinc-800">
                     <div className="relative">
                       <Loader2 className="h-12 w-12 animate-spin text-[#374DA4]" />
                       <QrCode className="h-5 w-5 text-[#B3BFF0] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                     </div>
                     <div className="text-center px-6">
                         <p className="text-sm font-bold text-foreground">assim que eu faço a conexão o QRCODE fica REGENERANDO e NUNCA CONECTA.</p>
                         <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">aguarde ({elapsedTime}s)</p>
                     </div>
                     {pollCount > 10 && (
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         onClick={() => regenerateQRCode()}
                         disabled={loading}
                         className="text-[#374DA4] text-[10px] hover:bg-[#F0F2FE] font-bold"
                       >
                         REFORÇAR GERADOR
                       </Button>
                     )}
                   </div>
                 )}
               </div>
 
               <div className="mt-8 flex flex-col items-center gap-2">
                 {status === 'connecting' && (
                   <div className="flex items-center gap-2 px-4 py-1.5 bg-[#F0F2FE] dark:bg-blue-950/20 rounded-full border border-[#DFE4FB] dark:border-[#0F1631]/30">
                     <div className="h-1.5 w-1.5 rounded-full bg-[#374DA4] animate-ping" />
                     <span className="text-[10px] font-bold text-[#253573] uppercase tracking-widest">Sincronizando...</span>
                   </div>
                 )}
                 {status === 'waiting_qr' && qrCode && (
                   <div className="flex items-center gap-2 px-4 py-1.5 bg-green-50 dark:bg-green-950/20 rounded-full border border-green-100 dark:border-green-900/30">
                     <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                     <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Aguardando Escaneamento</span>
                   </div>
                 )}
               </div>
             </div>

             {/* Right side - Instructions */}
             <div className="w-full md:w-80 flex flex-col gap-6 p-8 bg-zinc-50/50 dark:bg-zinc-900/50 border-t md:border-t-0 md:border-l border-border relative">
               <div className="hidden md:block">
                 <h3 className="font-bold text-lg text-foreground mb-1">Passo a passo</h3>
                 <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold opacity-60">Configuração rápida</p>
               </div>
 
               <div className="space-y-6 relative">
                 {/* Connector line */}
                 <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#B3BFF0] to-[#DFE4FB] dark:from-[#0F1631]/40 dark:to-transparent" />

                 <div className="flex items-start gap-4 relative z-10">
                   <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg" style={{ backgroundColor: '#374DA4' }}>1</div>
                   <div className="space-y-0.5">
                     <p className="text-sm font-bold">Abra o App</p>
                     <p className="text-xs text-muted-foreground leading-relaxed">Inicie o <strong>WhatsApp</strong> no seu dispositivo móvel.</p>
                   </div>
                 </div>
                 <div className="flex items-start gap-4 relative z-10">
                   <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg" style={{ backgroundColor: '#374DA4' }}>2</div>
                   <div className="space-y-0.5">
                     <p className="text-sm font-bold">Configurações</p>
                     <p className="text-xs text-muted-foreground leading-relaxed">Vá em <strong>Menu</strong> ou <strong>Configurações</strong>.</p>
                   </div>
                 </div>
                 <div className="flex items-start gap-4 relative z-10">
                   <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg" style={{ backgroundColor: '#374DA4' }}>3</div>
                   <div className="space-y-0.5">
                     <p className="text-sm font-bold">Aparelhos</p>
                     <p className="text-xs text-muted-foreground leading-relaxed">Toque em <strong>Aparelhos conectados</strong>.</p>
                   </div>
                 </div>
                 <div className="flex items-start gap-4 relative z-10">
                   <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg" style={{ backgroundColor: '#374DA4' }}>4</div>
                   <div className="space-y-0.5">
                     <p className="text-sm font-bold">Escanear</p>
                     <p className="text-xs text-muted-foreground leading-relaxed">Aponte para o <strong>QR Code</strong> ao lado.</p>
                   </div>
                 </div>
               </div>
 
               <div className="mt-auto pt-6 border-t border-dashed">
                 <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#374DA4]/5 dark:bg-blue-950/20 border border-[#DFE4FB]/50 dark:border-[#0F1631]/30">
                   <div className="p-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm">
                     <Shield className="h-4 w-4 text-[#374DA4]" />
                   </div>
                   <div className="space-y-0.5">
                     <p className="text-[10px] font-black uppercase tracking-widest text-[#374DA4]">Segurança Ativa</p>
                     <p className="text-[9px] text-muted-foreground">Conexão via túnel criptografado Evolution.</p>
                   </div>
                 </div>
               </div>
             </div>
          </div>
        )}

        {step === 'connected' && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Conectado com Sucesso!</h3>
            
            {phoneInfo && (
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 mb-4 text-left">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Número:</strong> {phoneInfo.phoneNumber}<br />
                  {phoneInfo.pushName && (
                    <><strong>Nome:</strong> {phoneInfo.pushName}</>
                  )}
                </p>
              </div>
            )}

            {/* Security Info */}
            <div className="bg-muted rounded-lg p-4 mb-4 text-left">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Conexão Segura</p>
                  <p className="text-xs text-muted-foreground">
                    Suas credenciais de sessão foram salvas de forma segura. 
                    A reconexão será automática caso a conexão caia.
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              Seu WhatsApp está pronto para receber e enviar mensagens.
            </p>
            <Button onClick={onClose} className="bg-green-600 hover:bg-green-700">
              Começar a usar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppQRModal;
